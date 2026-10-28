import { z } from "zod/v4";
import type { Prisma, StageKind } from "@prisma/client";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { SERVICE_LABELS, LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS } from "@/lib/format";
import { monthKey, monthlyStats, shiftMonth, emptyMonth } from "@/lib/monthly";
import { bankMonthlyStats, emptyBankMonth, topPayers } from "@/lib/bank-stats";
import { computeFinModel, FINMODEL_SETTING, parseFinModel } from "@/lib/finmodel";
import { clientLtv } from "@/lib/ltv";
import { tool, type Tool } from "@/lib/agents/tool";
import { editTools } from "@/lib/agents/crm-actions";

// Данные CRM, которые агент читает через инструменты. Инструменты сгруппированы по разделам:
// в настройках агента владелец отмечает разделы, и агент получает только их инструменты.
// Инструменты здесь только читают; изменения в CRM — отдельный раздел в crm-actions.ts

const TZ = "Europe/Moscow";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const day = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-CA", { timeZone: TZ }) : null);
const dayStart = (ymd: string) => new Date(`${ymd}T00:00:00+03:00`);
const dayAfter = (ymd: string) => new Date(dayStart(ymd).getTime() + 86_400_000);
const today = () => day(new Date())!;
const cut = (s: string | null | undefined, n = 300) => (s && s.length > n ? `${s.slice(0, n)}…` : (s ?? null));

const dateField = (what: string) => z.string().regex(DATE).describe(`${what}, YYYY-MM-DD по Москве`);
// Период с границами включительно; по умолчанию — текущий месяц до сегодня
const period = {
  from: dateField("Начало периода").optional(),
  to: dateField("Конец периода включительно").optional(),
};

function range(input: { from?: string; to?: string }) {
  const from = input.from ?? `${today().slice(0, 7)}-01`;
  const to = input.to ?? today();
  return { from, to, where: { gte: dayStart(from), lt: dayAfter(to) } };
}

const STATUS_KIND: Record<string, StageKind> = { open: "OPEN", won: "WON", lost: "LOST" };
const KIND_LABEL: Record<StageKind, string> = { OPEN: "в работе", WON: "оплачена", LOST: "проиграна" };

export { tool, type Tool } from "@/lib/agents/tool";

// ── Деньги ─────────────────────────────────────────────────────────────

const revenueSummary = tool({
  name: "revenue_summary",
  description:
    "Выручка за период двумя способами: поступления на расчётный счёт по выписке Точки и выручка по CRM (оплаченные сделки по дате закрытия). " +
    "Плюс счета, выставленные за период, и неоплаченные счета. По умолчанию — текущий месяц до сегодня.",
  schema: z.object(period),
  async run(input) {
    const { from, to, where } = range(input);
    const [payments, deals, invoices, unpaid, lastPayment] = await Promise.all([
      db.bankPayment.findMany({ where: { date: where }, select: { date: true, amount: true, payerName: true, payerInn: true, documentId: true } }),
      db.deal.findMany({
        where: { stage: { kind: "WON" }, closedAt: where },
        select: { title: true, amount: true, closedAt: true, company: { select: { name: true } } },
        orderBy: { amount: "desc" },
      }),
      db.document.findMany({ where: { kind: "INVOICE", date: where }, select: { amount: true, status: true } }),
      db.document.aggregate({ where: { kind: "INVOICE", status: { not: "PAID" } }, _sum: { amount: true }, _count: true }),
      db.bankPayment.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
    ]);
    const bankTotal = payments.reduce((a, p) => a + p.amount, 0);
    return {
      period: { from, to },
      bank: {
        total: bankTotal,
        payments: payments.length,
        by_invoices_from_crm: payments.filter((p) => p.documentId).reduce((a, p) => a + p.amount, 0),
        without_invoice: payments.filter((p) => !p.documentId).reduce((a, p) => a + p.amount, 0),
        top_payers: topPayers(payments, 5),
        last_payment_in_statement: day(lastPayment?.date),
        note: lastPayment ? undefined : "Выписка Точки ещё не загружена: банк не подключён или поступлений не было",
      },
      crm: {
        revenue: deals.reduce((a, d) => a + d.amount, 0),
        paid_deals: deals.length,
        deals: deals.slice(0, 15).map((d) => ({ title: d.title, client: d.company.name, amount: d.amount, closed: day(d.closedAt) })),
      },
      invoices_issued_in_period: {
        count: invoices.length,
        total: invoices.reduce((a, d) => a + d.amount, 0),
        paid: invoices.filter((d) => d.status === "PAID").reduce((a, d) => a + d.amount, 0),
      },
      unpaid_invoices_all_time: { count: unpaid._count, total: unpaid._sum.amount ?? 0 },
    };
  },
});

const monthlyReport = tool({
  name: "monthly_report",
  description:
    "Помесячная сводка за последние N месяцев: выручка CRM, оплаченные, новые и проигранные сделки, средний чек, поступления по банку, новые лиды. " +
    "Подходит для сравнения месяцев и динамики.",
  schema: z.object({ months: z.number().int().min(1).max(36).default(6).describe("Сколько месяцев, включая текущий") }),
  async run({ months }) {
    const now = monthKey(new Date());
    const first = shiftMonth(now, -(months - 1));
    const since = dayStart(`${first}-01`);
    const [deals, payments, leads] = await Promise.all([
      db.deal.findMany({ select: { amount: true, startDate: true, closedAt: true, stage: { select: { kind: true } } } }),
      db.bankPayment.findMany({ where: { date: { gte: since } }, select: { date: true, amount: true, payerName: true, payerInn: true, documentId: true } }),
      db.lead.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);
    const crm = monthlyStats(deals.map((d) => ({ amount: d.amount, kind: d.stage.kind, startDate: d.startDate, closedAt: d.closedAt })));
    const bank = bankMonthlyStats(payments);
    const leadCount = new Map<string, number>();
    for (const l of leads) leadCount.set(monthKey(l.createdAt), (leadCount.get(monthKey(l.createdAt)) ?? 0) + 1);
    return Array.from({ length: months }, (_, i) => {
      const key = shiftMonth(first, i);
      const m = crm.get(key) ?? emptyMonth(key);
      const b = bank.get(key) ?? emptyBankMonth(key);
      return {
        month: key,
        crm_revenue: m.revenue,
        paid_deals: m.paid,
        avg_check: m.avgCheck,
        new_deals: m.started,
        lost_deals: m.lost,
        bank_receipts: b.total,
        bank_payments: b.count,
        new_leads: leadCount.get(key) ?? 0,
        ...(key === now ? { note: `месяц идёт, данные по ${today()}` } : {}),
      };
    });
  },
});

const bankPayments = tool({
  name: "bank_payments",
  description: "Список поступлений на расчётный счёт из выписки Точки за период: дата, сумма, плательщик, назначение, к какому счёту CRM привязан.",
  schema: z.object({
    ...period,
    query: z.string().max(100).optional().describe("Поиск по плательщику, ИНН или назначению платежа"),
    without_invoice: z.boolean().optional().describe("Только поступления, не привязанные к счёту CRM"),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  async run(input) {
    const { from, to, where } = range(input);
    const q = input.query?.trim();
    const filter: Prisma.BankPaymentWhereInput = {
      date: where,
      ...(input.without_invoice ? { documentId: null } : {}),
      ...(q
        ? { OR: [{ payerName: { contains: q, mode: "insensitive" } }, { payerInn: { contains: q } }, { purpose: { contains: q, mode: "insensitive" } }] }
        : {}),
    };
    const [rows, sum] = await Promise.all([
      db.bankPayment.findMany({
        where: filter,
        orderBy: { date: "desc" },
        take: input.limit,
        include: { document: { select: { seq: true, year: true, company: { select: { name: true } } } } },
      }),
      db.bankPayment.aggregate({ where: filter, _sum: { amount: true }, _count: true }),
    ]);
    return {
      period: { from, to },
      total: sum._sum.amount ?? 0,
      count: sum._count,
      payments: rows.map((p) => ({
        date: day(p.date),
        amount: p.amount,
        payer: p.payerName,
        inn: p.payerInn,
        purpose: cut(p.purpose, 160),
        invoice: p.document ? `счёт № ${p.document.seq} от ${p.document.year}, ${p.document.company.name}` : null,
      })),
    };
  },
});

const listDocuments = tool({
  name: "list_documents",
  description: "Счета и акты из CRM: номер, дата, клиент, сумма, статус (выставлен, оплачен, просрочен). Можно искать неоплаченные счета.",
  schema: z.object({
    kind: z.enum(["invoice", "act", "any"]).default("invoice"),
    status: z.enum(["unpaid", "paid", "any"]).default("any"),
    ...period,
    all_time: z.boolean().optional().describe("Не ограничивать период (например, все неоплаченные счета)"),
    client: z.string().max(100).optional().describe("Название клиента"),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  async run(input) {
    const { from, to, where } = range(input);
    const filter: Prisma.DocumentWhereInput = {
      ...(input.kind === "any" ? {} : { kind: input.kind === "act" ? "ACT" : "INVOICE" }),
      ...(input.status === "paid" ? { status: "PAID" } : input.status === "unpaid" ? { status: { not: "PAID" } } : {}),
      ...(input.all_time ? {} : { date: where }),
      ...(input.client ? { company: { name: { contains: input.client, mode: "insensitive" } } } : {}),
    };
    const [rows, sum] = await Promise.all([
      db.document.findMany({
        where: filter,
        orderBy: { date: "desc" },
        take: input.limit,
        include: { company: { select: { name: true } }, deal: { select: { title: true } } },
      }),
      db.document.aggregate({ where: filter, _sum: { amount: true }, _count: true }),
    ]);
    const now = Date.now();
    return {
      period: input.all_time ? "за всё время" : { from, to },
      total: sum._sum.amount ?? 0,
      count: sum._count,
      documents: rows.map((d) => ({
        kind: d.kind === "ACT" ? "акт" : "счёт",
        number: `${d.seq}/${d.year}`,
        date: day(d.date),
        client: d.company.name,
        deal: d.deal.title,
        amount: d.amount,
        status: d.status === "PAID" ? "оплачен" : d.status === "EXPIRED" ? "просрочен" : "выставлен",
        paid_at: day(d.paidAt),
        ...(d.status !== "PAID" && d.kind === "INVOICE" ? { days_since_issued: Math.floor((now - d.date.getTime()) / 86_400_000) } : {}),
      })),
    };
  },
});

// ── Сделки и лиды ──────────────────────────────────────────────────────

const searchDeals = tool({
  name: "search_deals",
  description:
    "Поиск сделок: по названию или клиенту, статусу (в работе, оплачена, проиграна), этапу, ответственному, услуге и периоду. " +
    "Возвращает список и итог по сумме.",
  schema: z.object({
    query: z.string().max(100).optional().describe("Часть названия сделки или клиента"),
    status: z.enum(["open", "won", "lost", "any"]).default("any"),
    stage: z.string().max(60).optional().describe("Название этапа воронки"),
    owner: z.string().max(60).optional(),
    service: z.enum(["WEBSITE", "SEO", "CONTEXT_ADS", "BRANDING", "SMM", "OTHER"]).optional(),
    date_field: z.enum(["start", "closed", "expected_close"]).default("start").describe("По какой дате фильтровать период"),
    from: dateField("Начало периода").optional(),
    to: dateField("Конец периода включительно").optional(),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  async run(input) {
    const q = input.query?.trim();
    const dates =
      input.from || input.to
        ? { ...(input.from ? { gte: dayStart(input.from) } : {}), ...(input.to ? { lt: dayAfter(input.to) } : {}) }
        : undefined;
    const field = { start: "startDate", closed: "closedAt", expected_close: "expectedCloseDate" }[input.date_field];
    const filter: Prisma.DealWhereInput = {
      ...(input.status !== "any" ? { stage: { kind: STATUS_KIND[input.status] } } : {}),
      ...(input.stage ? { stage: { name: { contains: input.stage, mode: "insensitive" } } } : {}),
      ...(input.owner ? { owner: { contains: input.owner, mode: "insensitive" } } : {}),
      ...(input.service ? { service: input.service } : {}),
      ...(dates ? { [field]: dates } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    };
    const [rows, sum] = await Promise.all([
      db.deal.findMany({
        where: filter,
        orderBy: { updatedAt: "desc" },
        take: input.limit,
        include: { company: { select: { name: true } }, stage: { select: { name: true, kind: true } } },
      }),
      db.deal.aggregate({ where: filter, _sum: { amount: true }, _count: true }),
    ]);
    return {
      count: sum._count,
      total_amount: sum._sum.amount ?? 0,
      deals: rows.map((d) => ({
        id: d.id,
        title: d.title,
        client: d.company.name,
        amount: d.amount,
        stage: d.stage.name,
        status: KIND_LABEL[d.stage.kind],
        service: SERVICE_LABELS[d.service],
        owner: d.owner,
        started: day(d.startDate),
        expected_close: day(d.expectedCloseDate),
        closed: day(d.closedAt),
        lost_reason: d.lostReason,
        last_change: day(d.updatedAt),
        notes: cut(d.notes, 200),
      })),
    };
  },
});

const pipelineSummary = tool({
  name: "pipeline_summary",
  description:
    "Воронка сейчас: сколько сделок и на какую сумму на каждом этапе, сделки с ожидаемой оплатой в этом месяце и сделки без движения больше 14 дней.",
  schema: z.object({}),
  async run() {
    const [stages, open] = await Promise.all([
      db.stage.findMany({ orderBy: { order: "asc" }, include: { deals: { select: { amount: true } } } }),
      db.deal.findMany({
        where: { stage: { kind: "OPEN" } },
        include: { company: { select: { name: true } }, stage: { select: { name: true } } },
      }),
    ]);
    const month = today().slice(0, 7);
    const staleBefore = Date.now() - 14 * 86_400_000;
    const brief = (d: (typeof open)[number]) => ({
      title: d.title,
      client: d.company.name,
      amount: d.amount,
      stage: d.stage.name,
      expected_close: day(d.expectedCloseDate),
      last_change: day(d.updatedAt),
    });
    return {
      stages: stages.map((s) => ({
        stage: s.name,
        kind: KIND_LABEL[s.kind],
        deals: s.deals.length,
        amount: s.deals.reduce((a, d) => a + d.amount, 0),
      })),
      open_total: { deals: open.length, amount: open.reduce((a, d) => a + d.amount, 0) },
      expected_this_month: open.filter((d) => day(d.expectedCloseDate)?.startsWith(month)).map(brief),
      overdue_expected_close: open.filter((d) => d.expectedCloseDate && day(d.expectedCloseDate)! < today()).map(brief),
      stale_14_days: open
        .filter((d) => d.updatedAt.getTime() < staleBefore)
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
        .slice(0, 15)
        .map(brief),
    };
  },
});

const listLeads = tool({
  name: "list_leads",
  description: "Заявки (лиды) за период: сколько по статусам и источникам, UTM-метки, список заявок.",
  schema: z.object({
    ...period,
    status: z.enum(["NEW", "IN_PROGRESS", "CONVERTED", "REJECTED"]).optional(),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  async run(input) {
    const { from, to, where } = range(input);
    const filter: Prisma.LeadWhereInput = { createdAt: where, ...(input.status ? { status: input.status } : {}) };
    const rows = await db.lead.findMany({ where: filter, orderBy: { createdAt: "desc" } });
    const countBy = (key: (l: (typeof rows)[number]) => string | null) => {
      const m: Record<string, number> = {};
      for (const l of rows) {
        const k = key(l) ?? "—";
        m[k] = (m[k] ?? 0) + 1;
      }
      return m;
    };
    return {
      period: { from, to },
      count: rows.length,
      by_status: countBy((l) => LEAD_STATUS_LABELS[l.status]),
      by_source: countBy((l) => LEAD_SOURCE_LABELS[l.source]),
      by_utm_source: countBy((l) => l.utmSource),
      leads: rows.slice(0, input.limit).map((l) => ({
        id: l.id,
        date: day(l.createdAt),
        name: l.name,
        company: l.companyName,
        status: LEAD_STATUS_LABELS[l.status],
        form: l.formName,
        utm: [l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(" / ") || null,
        message: cut(l.message, 200),
        reject_reason: l.rejectReason,
      })),
    };
  },
});

// ── Клиенты ────────────────────────────────────────────────────────────

const searchClients = tool({
  name: "search_clients",
  description:
    "Поиск клиентов (компаний) по названию, ИНН, имени, телефону или email контакта. Без запроса — топ клиентов по LTV. " +
    "Для каждого: LTV (сумма оплаченных сделок), сумма в работе, число сделок.",
  schema: z.object({
    query: z.string().max(100).optional(),
    limit: z.number().int().min(1).max(50).default(15),
  }),
  async run(input) {
    const q = input.query?.trim();
    const rows = await db.company.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { inn: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
              { contacts: { some: { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } } },
            ],
          }
        : undefined,
      include: { deals: { select: { amount: true, startDate: true, stage: { select: { kind: true } } } }, contacts: { select: { fullName: true } } },
    });
    return rows
      .map((c) => ({ c, ltv: clientLtv(c) }))
      .sort((a, b) => b.ltv.ltv - a.ltv.ltv || b.ltv.open - a.ltv.open)
      .slice(0, input.limit)
      .map(({ c, ltv }) => ({
        id: c.id,
        name: c.name,
        inn: c.inn,
        contacts: c.contacts.map((x) => x.fullName),
        ltv: ltv.ltv,
        paid_deals: ltv.paidDeals,
        in_work: ltv.open,
        open_deals: ltv.openDeals,
        last_deal_started: day(c.deals.map((d) => d.startDate).sort((a, b) => b.getTime() - a.getTime())[0]),
      }));
  },
});

const clientCard = tool({
  name: "client_card",
  description:
    "Полная карточка клиента: реквизиты, контакты, все сделки, счета и оплаты, ближайшие и последние задачи и встречи, последние письма и сообщения. " +
    "Нужен id из search_clients или точное название.",
  schema: z.object({ id: z.string().max(40).optional(), name: z.string().max(120).optional() }),
  async run(input) {
    const company = await db.company.findFirst({
      where: input.id ? { id: input.id } : { name: { contains: input.name ?? "", mode: "insensitive" } },
      include: {
        contacts: true,
        deals: { include: { stage: { select: { name: true, kind: true } } }, orderBy: { startDate: "desc" } },
        documents: { orderBy: { date: "desc" }, take: 20 },
        events: { orderBy: { start: "desc" }, take: 15 },
        mails: { orderBy: { date: "desc" }, take: 8, select: { date: true, folder: true, subject: true, snippet: true, fromName: true } },
        chats: { select: { channel: true, messages: { orderBy: { createdAt: "desc" }, take: 5, select: { direction: true, text: true, createdAt: true } } } },
      },
    });
    if (!company) return { error: "Клиент не найден. Попробуйте search_clients." };
    const payments = company.inn
      ? await db.bankPayment.findMany({ where: { payerInn: company.inn }, orderBy: { date: "desc" }, take: 20 })
      : [];
    return {
      name: company.name,
      inn: company.inn,
      director: company.director,
      phone: company.phone,
      email: company.email,
      website: company.website,
      notes: cut(company.notes, 500),
      contacts: company.contacts.map((c) => ({ name: c.fullName, position: c.position, phone: c.phone, email: c.email })),
      ltv: clientLtv(company),
      deals: company.deals.map((d) => ({
        title: d.title,
        amount: d.amount,
        stage: d.stage.name,
        status: KIND_LABEL[d.stage.kind],
        started: day(d.startDate),
        closed: day(d.closedAt),
        lost_reason: d.lostReason,
      })),
      documents: company.documents.map((d) => ({
        kind: d.kind === "ACT" ? "акт" : "счёт",
        number: `${d.seq}/${d.year}`,
        date: day(d.date),
        amount: d.amount,
        status: d.status,
      })),
      bank_payments_by_inn: payments.map((p) => ({ date: day(p.date), amount: p.amount, purpose: cut(p.purpose, 120) })),
      events: company.events.map((e) => ({
        kind: e.kind === "TASK" ? "задача" : "встреча",
        title: e.title,
        start: day(e.start),
        done: e.done,
      })),
      recent_mail: company.mails.map((m) => ({
        date: day(m.date),
        direction: m.folder === "SENT" ? "мы написали" : `пишет ${m.fromName ?? "клиент"}`,
        subject: m.subject,
        snippet: cut(m.snippet, 160),
      })),
      recent_chat: company.chats.flatMap((c) =>
        c.messages.map((m) => ({ channel: c.channel, date: day(m.createdAt), from: m.direction === "IN" ? "клиент" : "мы", text: cut(m.text, 160) })),
      ),
    };
  },
});

// ── Задачи и календарь ─────────────────────────────────────────────────

const listEvents = tool({
  name: "list_events",
  description: "Задачи и встречи из календаря за период: что запланировано, что сделано, просроченные задачи.",
  schema: z.object({
    ...period,
    kind: z.enum(["task", "meeting", "any"]).default("any"),
    overdue_only: z.boolean().optional().describe("Только невыполненные задачи со сроком в прошлом"),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  async run(input) {
    const now = new Date();
    const r = input.from || input.to ? range(input) : null;
    const filter: Prisma.EventWhereInput = input.overdue_only
      ? { kind: "TASK", done: false, end: { lt: now } }
      : {
          ...(input.kind === "any" ? {} : { kind: input.kind === "task" ? "TASK" : "MEETING" }),
          start: r ? r.where : { gte: dayStart(today()), lt: new Date(dayStart(today()).getTime() + 7 * 86_400_000) },
        };
    const rows = await db.event.findMany({
      where: filter,
      orderBy: { start: "asc" },
      take: input.limit,
      include: { company: { select: { name: true } }, deal: { select: { title: true } } },
    });
    return {
      period: input.overdue_only ? "просроченные" : r ? { from: r.from, to: r.to } : "ближайшие 7 дней",
      events: rows.map((e) => ({
        kind: e.kind === "TASK" ? "задача" : "встреча",
        title: e.title,
        start: e.start.toLocaleString("ru-RU", { timeZone: TZ, dateStyle: "short", timeStyle: e.allDay ? undefined : "short" }),
        done: e.done,
        client: e.company?.name ?? null,
        deal: e.deal?.title ?? null,
        notes: cut(e.notes, 150),
      })),
    };
  },
});

// ── Почта и чаты ───────────────────────────────────────────────────────

const searchMessages = tool({
  name: "search_messages",
  description: "Поиск по письмам и сообщениям из мессенджеров: по тексту, теме или клиенту за период. Возвращает отрывки.",
  schema: z.object({
    query: z.string().max(100).optional().describe("Слова из текста или темы"),
    client: z.string().max(100).optional().describe("Название клиента"),
    channel: z.enum(["mail", "chat", "any"]).default("any"),
    from: dateField("Начало периода").optional(),
    to: dateField("Конец периода включительно").optional(),
    limit: z.number().int().min(1).max(50).default(15),
  }),
  async run(input) {
    const q = input.query?.trim();
    const dates =
      input.from || input.to
        ? { ...(input.from ? { gte: dayStart(input.from) } : {}), ...(input.to ? { lt: dayAfter(input.to) } : {}) }
        : undefined;
    const client = input.client ? { company: { name: { contains: input.client, mode: "insensitive" as const } } } : {};
    const [mails, chats] = await Promise.all([
      input.channel === "chat"
        ? []
        : db.mailMessage.findMany({
            where: {
              ...client,
              ...(dates ? { date: dates } : {}),
              ...(q ? { OR: [{ subject: { contains: q, mode: "insensitive" } }, { text: { contains: q, mode: "insensitive" } }] } : {}),
            },
            orderBy: { date: "desc" },
            take: input.limit,
            select: { date: true, folder: true, fromName: true, fromEmail: true, to: true, subject: true, snippet: true, company: { select: { name: true } } },
          }),
      input.channel === "mail"
        ? []
        : db.chatMessage.findMany({
            where: {
              ...(dates ? { createdAt: dates } : {}),
              ...(q ? { text: { contains: q, mode: "insensitive" } } : {}),
              ...(input.client ? { conversation: client } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: input.limit,
            select: { createdAt: true, direction: true, text: true, conversation: { select: { channel: true, name: true, company: { select: { name: true } } } } },
          }),
    ]);
    return {
      mail: mails.map((m) => ({
        date: day(m.date),
        direction: m.folder === "SENT" ? `мы → ${m.to}` : `${m.fromName ?? m.fromEmail} → нам`,
        client: m.company?.name ?? null,
        subject: m.subject,
        snippet: cut(m.snippet, 200),
      })),
      chat: chats.map((m) => ({
        date: day(m.createdAt),
        channel: m.conversation.channel,
        with: m.conversation.name,
        client: m.conversation.company?.name ?? null,
        from: m.direction === "IN" ? "собеседник" : "мы",
        text: cut(m.text, 200),
      })),
    };
  },
});

// ── Финмодель и прайс ──────────────────────────────────────────────────

const getFinmodel = tool({
  name: "get_finmodel",
  description:
    "Финмодель компании из Дашборда: сценарии (от минимального до желаемого), клиенты и средний чек по направлениям, затраты, налог, " +
    "плановая выручка и прибыль по каждому сценарию. Плюс факт текущего месяца для сравнения с планом.",
  schema: z.object({}),
  async run() {
    const raw = await getSetting(FINMODEL_SETTING);
    if (!raw) return { error: "Финмодель ещё не заполнена: её можно загрузить в Дашборде на вкладке «Финмодель»" };
    const model = parseFinModel(raw);
    const t = computeFinModel(model);
    const fact = (await revenueSummary.run({} as never)) as { bank: { total: number }; crm: { revenue: number } };
    return {
      scenarios: model.scenarios.map((name, i) => ({
        scenario: name,
        revenue: t.revenue[i],
        costs: t.costs[i],
        tax: t.tax[i],
        profit: t.profit[i],
        margin_percent: t.margin[i],
        services: model.services.map((s, k) => ({ service: s.name, clients: s.clients[i], avg_check: s.check[i], revenue: t.revenueByService[k][i] })),
        cost_groups: model.costs.map((g, k) => ({ group: g.title, total: t.groupTotals[k][i], rows: g.rows.map((r) => ({ name: r.name, amount: r.values[i] })) })),
      })),
      tax_percent_of_revenue: model.taxPercent,
      fact_this_month: { month: monthKey(new Date()), crm_revenue: fact.crm.revenue, bank_receipts: fact.bank.total, as_of: today() },
    };
  },
});

export const priceList = tool({
  name: "price_list",
  description: "Прайс студии: услуги с ценами и категориями. Можно искать по названию.",
  schema: z.object({ query: z.string().max(100).optional() }),
  async run({ query }) {
    const rows = await db.product.findMany({
      where: query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }] } : undefined,
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      take: 80,
    });
    return rows.map((p) => ({ category: p.category, name: p.name, price: p.price, unit: p.unit, description: cut(p.description, 120) }));
  },
});

export const SCOPES = [
  { key: "money", label: "Деньги", hint: "Выручка, поступления по банку, счета и акты", tools: [revenueSummary, monthlyReport, bankPayments, listDocuments] },
  { key: "sales", label: "Сделки и лиды", hint: "Воронка, сделки, заявки с сайта", tools: [searchDeals, pipelineSummary, listLeads] },
  { key: "clients", label: "Клиенты", hint: "Карточки клиентов, контакты, LTV", tools: [searchClients, clientCard] },
  { key: "work", label: "Задачи и календарь", hint: "Задачи, встречи, просрочки", tools: [listEvents] },
  { key: "comms", label: "Почта и чаты", hint: "Письма и сообщения клиентов", tools: [searchMessages] },
  { key: "plan", label: "Финмодель и прайс", hint: "План по сценариям, цены услуг", tools: [getFinmodel, priceList] },
  {
    key: "edit",
    label: "Изменения в CRM",
    hint: "Создаёт лиды, клиентов, сделки, встречи и задачи, двигает сделки по воронке. Ничего не удаляет",
    tools: editTools,
  },
] as const;

export type ScopeKey = (typeof SCOPES)[number]["key"];
export const ALL_SCOPES = SCOPES.map((s) => s.key) as ScopeKey[];

export function isScope(key: string): key is ScopeKey {
  return SCOPES.some((s) => s.key === key);
}

export function toolsFor(scopes: string[]): Tool[] {
  return SCOPES.filter((s) => scopes.includes(s.key)).flatMap((s) => [...s.tools] as Tool[]);
}

// Под ответом показываем, какие разделы агент открывал
export function scopeOfTool(name: string) {
  return SCOPES.find((s) => s.tools.some((t) => t.name === name))?.label ?? null;
}

// Описание инструмента для API Claude: схема входа из zod
export function toolDefinition(t: Tool) {
  const { $schema: _, ...schema } = z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>;
  return { name: t.name, description: t.description, input_schema: schema as { type: "object"; [k: string]: unknown } };
}

// Запуск инструмента: вход проверяется схемой, ошибка возвращается агенту текстом, а не роняет чат
export async function runTool(tools: Tool[], name: string, input: unknown): Promise<{ ok: boolean; content: string }> {
  const t = tools.find((x) => x.name === name);
  if (!t) return { ok: false, content: `Инструмент ${name} недоступен этому агенту` };
  const parsed = t.schema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, content: `Неверные параметры: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
  try {
    return { ok: true, content: JSON.stringify(await t.run(parsed.data as never)) };
  } catch (e) {
    return { ok: false, content: `Ошибка: ${e instanceof Error ? e.message : String(e)}` };
  }
}
