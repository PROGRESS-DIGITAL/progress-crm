import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import type { StageKind } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays, fromKey, isDayKey, REMIND_OPTIONS } from "@/lib/calendar";
import { getOwner } from "@/lib/profile";
import { tool } from "@/lib/agents/tool";

// Инструменты, которые меняют CRM: создают лиды, клиентов, сделки, встречи и задачи и двигают
// сделки по воронке. Удалять агент не умеет. Каждый ответ содержит ссылку на созданную карточку,
// чтобы агент дал её владельцу

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).optional();
const date = z.string().refine(isDayKey, "Дата в формате YYYY-MM-DD").describe("Дата по Москве, YYYY-MM-DD");
const SERVICES = ["WEBSITE", "SEO", "CONTEXT_ADS", "BRANDING", "SMM", "OTHER"] as const;

// Страницы, которые показывают изменённые данные; вне запроса (фоновые задачи) обновлять нечего
function refresh(...paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {}
  }
}

async function findCompany(input: { client_id?: string; client_name?: string }) {
  if (input.client_id) return db.company.findUnique({ where: { id: input.client_id }, select: { id: true, name: true } });
  if (input.client_name)
    return db.company.findFirst({ where: { name: { equals: input.client_name.trim(), mode: "insensitive" } }, select: { id: true, name: true } });
  return null;
}

// Этап по названию: сначала точное совпадение, потом по части названия, если оно одно
async function findStage(name: string) {
  const stages = await db.stage.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, kind: true } });
  const q = name.trim().toLowerCase();
  const exact = stages.find((s) => s.name.toLowerCase() === q);
  const partial = stages.filter((s) => s.name.toLowerCase().includes(q));
  const stage = exact ?? (partial.length === 1 ? partial[0] : null);
  if (!stage) throw new Error(`Этап «${name}» не найден. Этапы воронки: ${stages.map((s) => s.name).join(", ")}`);
  return stage;
}

// Дата оплаты или проигрыша ставится при переходе в закрытый этап и снимается при возврате в работу,
// как при перетаскивании карточки на доске
function closedAtFor(to: StageKind, before: { kind: StageKind; closedAt: Date | null } | null) {
  if (to === "OPEN") return null;
  return before && before.kind !== "OPEN" && before.closedAt ? before.closedAt : new Date();
}

async function topPosition(stageId: string) {
  const top = await db.deal.findFirst({ where: { stageId }, orderBy: { position: "asc" }, select: { position: true } });
  return (top?.position ?? 1) - 1;
}

const createLead = tool({
  name: "create_lead",
  description: "Создать лид (заявку) в разделе «Лиды». Нужно хотя бы имя, телефон или email.",
  schema: z.object({
    name: optional(120),
    phone: optional(40),
    email: optional(120),
    company_name: optional(200),
    message: optional(2000).describe("Что нужно клиенту"),
  }),
  async run(input) {
    if (!input.name && !input.phone && !input.email) throw new Error("Укажите имя, телефон или email");
    const lead = await db.lead.create({
      data: {
        name: input.name || null,
        phone: input.phone || null,
        email: input.email || null,
        companyName: input.company_name || null,
        message: input.message || null,
        owner: (await getOwner()).name,
      },
    });
    refresh("/leads");
    return { created: true, id: lead.id, link: `/leads/${lead.id}` };
  },
});

const createClient = tool({
  name: "create_client",
  description:
    "Создать клиента (компанию) и, если известно, его контактное лицо. Если клиент с таким названием или ИНН уже есть, новый не создаётся: вернётся существующий.",
  schema: z.object({
    name: text(200).describe("Название компании или имя клиента"),
    inn: z.string().regex(/^\d{10}(\d{2})?$/, "ИНН из 10 или 12 цифр").optional(),
    phone: optional(40),
    email: optional(120),
    website: optional(200),
    notes: optional(2000),
    contact: z
      .object({ full_name: text(120), position: optional(120), phone: optional(40), email: optional(120) })
      .optional()
      .describe("Контактное лицо"),
  }),
  async run(input) {
    const existing = await db.company.findFirst({
      where: { OR: [{ name: { equals: input.name, mode: "insensitive" } }, ...(input.inn ? [{ inn: input.inn }] : [])] },
      select: { id: true, name: true },
    });
    if (existing) return { created: false, note: "Такой клиент уже есть", id: existing.id, name: existing.name, link: `/clients/${existing.id}` };
    const company = await db.company.create({
      data: {
        name: input.name,
        inn: input.inn ?? null,
        phone: input.phone || null,
        email: input.email || null,
        website: input.website || null,
        notes: input.notes || null,
        ...(input.contact && {
          contacts: {
            create: {
              fullName: input.contact.full_name,
              position: input.contact.position || null,
              phone: input.contact.phone || null,
              email: input.contact.email || null,
            },
          },
        }),
      },
    });
    refresh("/clients");
    return { created: true, id: company.id, name: company.name, link: `/clients/${company.id}` };
  },
});

const createDeal = tool({
  name: "create_deal",
  description:
    "Создать сделку у существующего клиента. Клиента укажи по id из search_clients или по точному названию; если его нет, сначала create_client. " +
    "Без этапа сделка встаёт в первый этап воронки.",
  schema: z.object({
    title: text(200),
    client_id: z.string().optional(),
    client_name: optional(200),
    amount: z.number().int().min(0).max(1_000_000_000).optional().describe("Сумма в рублях"),
    service: z.enum(SERVICES).optional(),
    stage: optional(60).describe("Название этапа воронки"),
    expected_close: date.optional().describe("Ожидаемая дата оплаты, YYYY-MM-DD"),
    notes: optional(2000),
  }),
  async run(input) {
    const company = await findCompany(input);
    if (!company) throw new Error("Клиент не найден. Найдите его через search_clients или создайте через create_client");
    const stage = input.stage
      ? await findStage(input.stage)
      : await db.stage.findFirst({ where: { kind: "OPEN" }, orderBy: { order: "asc" }, select: { id: true, name: true, kind: true } });
    if (!stage) throw new Error("В воронке нет этапов");
    const deal = await db.deal.create({
      data: {
        title: input.title,
        companyId: company.id,
        amount: input.amount ?? 0,
        service: input.service ?? "WEBSITE",
        stageId: stage.id,
        expectedCloseDate: input.expected_close ? fromKey(input.expected_close) : null,
        notes: input.notes || null,
        owner: (await getOwner()).name,
        closedAt: closedAtFor(stage.kind, null),
        position: await topPosition(stage.id),
      },
    });
    refresh("/deals", `/clients/${company.id}`, "/dashboard", "/sales-map");
    return { created: true, id: deal.id, client: company.name, stage: stage.name, link: `/deals/${deal.id}` };
  },
});

const moveDeal = tool({
  name: "move_deal",
  description:
    "Перенести сделку в другой этап воронки, как перетаскивание карточки на доске. Id сделки — из search_deals. " +
    "При переносе в «оплачено» или «проиграно» ставится дата закрытия.",
  schema: z.object({
    deal_id: z.string().min(1),
    stage: text(60).describe("Название этапа, куда перенести"),
    lost_reason: optional(300).describe("Причина проигрыша, если сделка проиграна"),
  }),
  async run(input) {
    const deal = await db.deal.findUnique({
      where: { id: input.deal_id },
      select: { id: true, title: true, companyId: true, closedAt: true, stage: { select: { id: true, name: true, kind: true } } },
    });
    if (!deal) throw new Error("Сделка не найдена. Найдите её через search_deals");
    const stage = await findStage(input.stage);
    if (stage.id === deal.stage.id) return { moved: false, note: `Сделка уже на этапе «${stage.name}»`, link: `/deals/${deal.id}` };
    await db.deal.update({
      where: { id: deal.id },
      data: {
        stageId: stage.id,
        closedAt: closedAtFor(stage.kind, { kind: deal.stage.kind, closedAt: deal.closedAt }),
        position: await topPosition(stage.id),
        ...(stage.kind === "LOST" && input.lost_reason ? { lostReason: input.lost_reason } : {}),
      },
    });
    refresh("/deals", `/deals/${deal.id}`, `/clients/${deal.companyId}`, "/dashboard", "/sales-map");
    return { moved: true, deal: deal.title, from: deal.stage.name, to: stage.name, link: `/deals/${deal.id}` };
  },
});

const createEvent = tool({
  name: "create_event",
  description:
    "Создать встречу или задачу в календаре. Без времени событие ставится на весь день. Можно привязать к клиенту и сделке. " +
    "Напоминание приходит владельцу в Telegram.",
  schema: z.object({
    kind: z.enum(["meeting", "task"]),
    title: text(200),
    date,
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Время в формате ЧЧ:ММ")
      .optional()
      .describe("Начало по Москве, ЧЧ:ММ"),
    duration_minutes: z.number().int().min(5).max(24 * 60).default(60),
    client_id: z.string().optional(),
    client_name: optional(200),
    deal_id: z.string().optional(),
    notes: optional(5000),
    remind_minutes: z
      .number()
      .int()
      .refine((v) => REMIND_OPTIONS.some((o) => o.value === v), `Одно из: ${REMIND_OPTIONS.map((o) => o.value).join(", ")}`)
      .optional()
      .describe("За сколько минут напомнить в Telegram"),
  }),
  async run(input) {
    let companyId: string | null = null;
    let dealId: string | null = null;
    if (input.deal_id) {
      const deal = await db.deal.findUnique({ where: { id: input.deal_id }, select: { id: true, companyId: true } });
      if (!deal) throw new Error("Сделка не найдена. Найдите её через search_deals");
      dealId = deal.id;
      companyId = deal.companyId;
    } else if (input.client_id || input.client_name) {
      const company = await findCompany(input);
      if (!company) throw new Error("Клиент не найден. Найдите его через search_clients или создайте через create_client");
      companyId = company.id;
    }
    const start = input.time ? fromKey(input.date, Number(input.time.slice(0, 2)) * 60 + Number(input.time.slice(3))) : fromKey(input.date);
    const end = input.time ? new Date(start.getTime() + input.duration_minutes * 60_000) : fromKey(addDays(input.date, 1));
    const event = await db.event.create({
      data: {
        kind: input.kind === "task" ? "TASK" : "MEETING",
        title: input.title,
        notes: input.notes || null,
        start,
        end,
        allDay: !input.time,
        companyId,
        dealId,
        remindMinutes: input.remind_minutes ?? null,
      },
    });
    refresh("/calendar", "/tasks", ...(companyId ? [`/clients/${companyId}`] : []), ...(dealId ? [`/deals/${dealId}`] : []));
    return {
      created: true,
      id: event.id,
      link: input.kind === "task" ? `/tasks/${event.id}` : `/calendar?date=${input.date}&open=${event.id}`,
    };
  },
});

export const editTools = [createLead, createClient, createDeal, moveDeal, createEvent];
