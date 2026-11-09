import type { Prisma } from "@prisma/client";
import { db, withoutActivity } from "@/lib/db";
import { logActivity } from "@/lib/activity";

// Корзина: удаление переносит запись сюда целиком, со всем, что удаляется вместе с ней,
// и со списком связей, которые база обнуляет (встречи сделки, оплаты счёта). Восстановление
// создаёт записи заново с теми же id и возвращает связи, если связанная запись ещё есть

export type TrashKind = "lead" | "deal" | "company" | "contact" | "event" | "document" | "contract" | "product" | "knowledge";

export const TRASH_KINDS: Record<TrashKind, { label: string; deleted: string; restored: string; section: string }> = {
  lead: { label: "Лид", deleted: "Удалён лид", restored: "Восстановлен лид", section: "leads" },
  deal: { label: "Сделка", deleted: "Удалена сделка", restored: "Восстановлена сделка", section: "deals" },
  company: { label: "Клиент", deleted: "Удалён клиент", restored: "Восстановлен клиент", section: "clients" },
  contact: { label: "Контакт", deleted: "Удалён контакт", restored: "Восстановлен контакт", section: "clients" },
  event: { label: "Встреча или задача", deleted: "Удалено событие", restored: "Восстановлено событие", section: "calendar" },
  document: { label: "Счёт или акт", deleted: "Удалён документ", restored: "Восстановлен документ", section: "finance" },
  contract: { label: "Договор", deleted: "Удалён договор", restored: "Восстановлен договор", section: "documents" },
  product: { label: "Услуга", deleted: "Удалена услуга", restored: "Восстановлена услуга", section: "price" },
  knowledge: { label: "Материал базы знаний", deleted: "Из базы знаний удалён материал", restored: "В базу знаний возвращён материал", section: "documents" },
};

export class TrashError extends Error {}

type Row = Record<string, unknown>;
type Snapshot = { row: Row; children?: Record<string, Row[]>; links?: Record<string, string[]> };

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const ids = (list: { id: string }[]) => list.map((x) => x.id);
// Поля связей из include в саму строку не входят
function pick<T extends Row>(row: T, drop: string[]): Row {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !drop.includes(k)));
}

function quoted(kind: TrashKind, title: string) {
  return kind === "contact" ? title : `«${title}»`;
}

// Встреча и задача хранятся одной моделью, а в журнале называются по-своему
export function trashWording(kind: TrashKind, section: string) {
  if (kind === "event")
    return section === "tasks"
      ? { label: "Задача", deleted: "Удалена задача", restored: "Восстановлена задача" }
      : { label: "Встреча", deleted: "Удалена встреча", restored: "Восстановлена встреча" };
  return TRASH_KINDS[kind];
}

async function put(kind: TrashKind, title: string, snapshot: Snapshot, remove: (tx: Prisma.TransactionClient) => Promise<unknown>, section?: string) {
  const meta = TRASH_KINDS[kind];
  const { currentUser } = await import("@/lib/auth/session");
  const actor = await currentUser().then((u) => u?.name ?? null, () => null);
  const item = await db.$transaction(async (tx) => {
    const created = await tx.trashItem.create({
      data: { kind, section: section ?? meta.section, title, data: json(snapshot), deletedBy: actor },
    });
    await remove(tx as unknown as Prisma.TransactionClient);
    return created;
  });
  const words = trashWording(kind, item.section);
  await logActivity({ section: item.section, kind: "delete", text: `${words.deleted} ${quoted(kind, title)}`, href: `/trash#${item.id}` }, actor);
  return item;
}

export async function trashDeal(id: string) {
  const deal = await db.deal.findUnique({
    where: { id },
    include: {
      documents: { include: { payments: { select: { id: true } } } },
      lead: { select: { id: true } },
      events: { select: { id: true } },
      contracts: { select: { id: true } },
      proposals: true,
    },
  });
  if (!deal) return null;
  const payments = Object.fromEntries(deal.documents.map((d) => [d.id, ids(d.payments)]));
  await put(
    "deal",
    deal.title,
    {
      row: pick(deal, ["documents", "lead", "events", "contracts", "proposals"]),
      children: {
        // Счета раньше актов: акт ссылается на свой счёт
        documents: [...deal.documents].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "INVOICE" ? -1 : 1)).map((d) => pick(d, ["payments"])),
        // КП удаляются вместе со сделкой; логотип клиента хранится в корзине строкой base64
        proposals: deal.proposals.map((p) => ({ ...p, logo: p.logo ? Buffer.from(p.logo).toString("base64") : null })),
      },
      links: { lead: deal.lead ? [deal.lead.id] : [], events: ids(deal.events), contracts: ids(deal.contracts), ...prefixed("payments:", payments) },
    },
    (tx) => tx.deal.delete({ where: { id } }),
  );
  return deal;
}

export async function trashCompany(id: string) {
  const company = await db.company.findUnique({
    where: { id },
    include: {
      contacts: { include: { deals: { select: { id: true } } } },
      events: { select: { id: true } },
      contracts: { select: { id: true } },
      chats: { select: { id: true } },
      mails: { select: { id: true } },
    },
  });
  if (!company) return null;
  await put(
    "company",
    company.name,
    {
      row: pick(company, ["contacts", "events", "contracts", "chats", "mails"]),
      children: { contacts: company.contacts.map((c) => pick(c, ["deals"])) },
      links: {
        events: ids(company.events),
        contracts: ids(company.contracts),
        chats: ids(company.chats),
        mails: ids(company.mails),
        ...prefixed("contactDeals:", Object.fromEntries(company.contacts.map((c) => [c.id, ids(c.deals)]))),
      },
    },
    (tx) => tx.company.delete({ where: { id } }),
  );
  return company;
}

export async function trashContact(id: string) {
  const contact = await db.contact.findUnique({ where: { id }, include: { deals: { select: { id: true } } } });
  if (!contact) return null;
  await put("contact", contact.fullName, { row: pick(contact, ["deals"]), links: { deals: ids(contact.deals) } }, (tx) =>
    tx.contact.delete({ where: { id } }),
  );
  return contact;
}

export async function trashEvent(id: string) {
  const event = await db.event.findUnique({ where: { id }, include: { files: true, comments: true, linked: { select: { id: true } } } });
  if (!event) return null;
  await put(
    "event",
    event.title,
    {
      row: pick(event, ["files", "comments", "linked"]),
      children: { files: event.files.map((f) => ({ ...f, data: Buffer.from(f.data).toString("base64") })), comments: event.comments },
      links: { linked: ids(event.linked) },
    },
    (tx) => tx.event.delete({ where: { id } }),
    event.kind === "TASK" ? "tasks" : "calendar",
  );
  return event;
}

export async function trashDocument(id: string) {
  const doc = await db.document.findUnique({ where: { id }, include: { payments: { select: { id: true } }, acts: { select: { id: true } } } });
  if (!doc) return null;
  const title = `${doc.kind === "INVOICE" ? "Счёт" : "Акт"} № ${doc.seq}`;
  await put("document", title, { row: pick(doc, ["payments", "acts"]), links: { payments: ids(doc.payments), acts: ids(doc.acts) } }, (tx) =>
    tx.document.delete({ where: { id } }),
  );
  return doc;
}

export async function trashContract(id: string) {
  const contract = await db.contract.findUnique({ where: { id } });
  if (!contract) return null;
  await put("contract", `Договор № ${contract.number}`, { row: contract }, (tx) => tx.contract.delete({ where: { id } }));
  return contract;
}

export async function trashKnowledge(id: string) {
  const item = await db.knowledgeItem.findUnique({ where: { id }, include: { files: true } });
  if (!item) return null;
  await put(
    "knowledge",
    item.title,
    { row: pick(item, ["files"]), children: { files: item.files.map((f) => ({ ...f, data: Buffer.from(f.data).toString("base64") })) } },
    (tx) => tx.knowledgeItem.delete({ where: { id } }),
  );
  return item;
}

export async function trashLead(id: string) {
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return null;
  await put("lead", lead.name ?? lead.phone ?? lead.email ?? lead.companyName ?? "Без имени", { row: lead }, (tx) => tx.lead.delete({ where: { id } }));
  return lead;
}

export async function trashProduct(id: string) {
  const product = await db.product.findUnique({ where: { id }, include: { deals: { select: { id: true } } } });
  if (!product) return null;
  await put("product", product.name, { row: pick(product, ["deals"]), links: { deals: ids(product.deals) } }, (tx) =>
    tx.product.delete({ where: { id } }),
  );
  return product;
}

function prefixed(prefix: string, map: Record<string, string[]>) {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [prefix + k, v]));
}

// ——— Восстановление ———

type Tx = Prisma.TransactionClient;
const str = (v: unknown) => (typeof v === "string" ? v : null);

// Необязательная связь остаётся, только если запись ещё есть
async function keep(id: unknown, find: (id: string) => Promise<unknown>) {
  const v = str(id);
  return v && (await find(v)) ? v : null;
}

async function restoreDocument(tx: Tx, row: Row, payments: string[], acts: string[]) {
  const taken = await tx.document.findFirst({
    where: { kind: row.kind as "INVOICE" | "ACT", year: row.year as number, seq: row.seq as number },
    select: { id: true },
  });
  if (taken) throw new TrashError(`Номер ${row.seq} уже занят другим документом`);
  const invoiceId = await keep(row.invoiceId, (id) => tx.document.findUnique({ where: { id }, select: { id: true } }));
  await tx.document.create({ data: { ...(row as Prisma.DocumentUncheckedCreateInput), invoiceId } });
  const id = row.id as string;
  if (payments.length) await tx.bankPayment.updateMany({ where: { id: { in: payments }, documentId: null }, data: { documentId: id } });
  if (acts.length) await tx.document.updateMany({ where: { id: { in: acts }, invoiceId: null }, data: { invoiceId: id } });
}

async function restoreSnapshot(tx: Tx, kind: TrashKind, s: Snapshot) {
  const { row } = s;
  const links = s.links ?? {};
  const id = row.id as string;
  const relink = (list: string[] | undefined, run: (ids: string[]) => Promise<unknown>) => (list?.length ? run(list) : null);

  switch (kind) {
    case "deal": {
      if (!(await tx.company.findUnique({ where: { id: row.companyId as string }, select: { id: true } })))
        throw new TrashError("Клиента этой сделки уже нет: сначала восстановите клиента");
      const stage =
        (await keep(row.stageId, (v) => tx.stage.findUnique({ where: { id: v }, select: { id: true } }))) ??
        (await tx.stage.findFirst({ orderBy: { order: "asc" }, select: { id: true } }))?.id;
      if (!stage) throw new TrashError("В воронке нет этапов");
      await tx.deal.create({
        data: {
          ...(row as Prisma.DealUncheckedCreateInput),
          stageId: stage,
          contactId: await keep(row.contactId, (v) => tx.contact.findUnique({ where: { id: v }, select: { id: true } })),
          productId: await keep(row.productId, (v) => tx.product.findUnique({ where: { id: v }, select: { id: true } })),
        },
      });
      for (const d of s.children?.documents ?? []) await restoreDocument(tx, d, links[`payments:${d.id}`] ?? [], []);
      for (const p of s.children?.proposals ?? [])
        await tx.proposal.create({
          data: { ...(p as Prisma.ProposalUncheckedCreateInput), logo: typeof p.logo === "string" ? Buffer.from(p.logo, "base64") : null },
        });
      await relink(links.lead, (v) => tx.lead.updateMany({ where: { id: { in: v }, dealId: null }, data: { dealId: id } }));
      await relink(links.events, (v) => tx.event.updateMany({ where: { id: { in: v }, dealId: null }, data: { dealId: id } }));
      await relink(links.contracts, (v) => tx.contract.updateMany({ where: { id: { in: v }, dealId: null }, data: { dealId: id } }));
      return `/deals/${id}`;
    }
    case "company": {
      await tx.company.create({ data: row as Prisma.CompanyUncheckedCreateInput });
      for (const c of s.children?.contacts ?? []) {
        await tx.contact.create({ data: c as Prisma.ContactUncheckedCreateInput });
        await relink(links[`contactDeals:${c.id}`], (v) => tx.deal.updateMany({ where: { id: { in: v }, contactId: null }, data: { contactId: c.id as string } }));
      }
      await relink(links.events, (v) => tx.event.updateMany({ where: { id: { in: v }, companyId: null }, data: { companyId: id } }));
      await relink(links.contracts, (v) => tx.contract.updateMany({ where: { id: { in: v }, companyId: null }, data: { companyId: id } }));
      await relink(links.chats, (v) => tx.conversation.updateMany({ where: { id: { in: v }, companyId: null }, data: { companyId: id } }));
      await relink(links.mails, (v) => tx.mailMessage.updateMany({ where: { id: { in: v }, companyId: null }, data: { companyId: id } }));
      return `/clients/${id}`;
    }
    case "contact": {
      if (!(await tx.company.findUnique({ where: { id: row.companyId as string }, select: { id: true } })))
        throw new TrashError("Клиента этого контакта уже нет: сначала восстановите клиента");
      await tx.contact.create({ data: row as Prisma.ContactUncheckedCreateInput });
      await relink(links.deals, (v) => tx.deal.updateMany({ where: { id: { in: v }, contactId: null }, data: { contactId: id } }));
      return `/clients/${row.companyId}`;
    }
    case "event": {
      await tx.event.create({
        data: {
          ...(row as Prisma.EventUncheckedCreateInput),
          companyId: await keep(row.companyId, (v) => tx.company.findUnique({ where: { id: v }, select: { id: true } })),
          dealId: await keep(row.dealId, (v) => tx.deal.findUnique({ where: { id: v }, select: { id: true } })),
          taskId: await keep(row.taskId, (v) => tx.event.findUnique({ where: { id: v }, select: { id: true } })),
          // Столбец могли удалить: тогда задача встаёт на основную доску
          columnId: await keep(row.columnId, (v) => tx.boardColumn.findUnique({ where: { id: v }, select: { id: true } })),
          assigneeId: await keep(row.assigneeId, (v) => tx.employee.findUnique({ where: { id: v }, select: { id: true } })),
        },
      });
      for (const f of s.children?.files ?? [])
        await tx.eventFile.create({ data: { ...(f as Prisma.EventFileUncheckedCreateInput), data: Buffer.from(String(f.data), "base64") } });
      for (const c of s.children?.comments ?? [])
        await tx.eventComment.create({
          data: {
            ...(c as Prisma.EventCommentUncheckedCreateInput),
            authorId: await keep(c.authorId, (v) => tx.employee.findUnique({ where: { id: v }, select: { id: true } })),
          },
        });
      await relink(links.linked, (v) => tx.event.updateMany({ where: { id: { in: v }, taskId: null }, data: { taskId: id } }));
      return row.kind === "TASK" ? `/tasks/${id}` : `/calendar?open=${id}&date=${String(row.start).slice(0, 10)}`;
    }
    case "document": {
      if (!(await tx.deal.findUnique({ where: { id: row.dealId as string }, select: { id: true } })))
        throw new TrashError("Сделки этого документа уже нет: сначала восстановите сделку");
      await restoreDocument(tx, row, links.payments ?? [], links.acts ?? []);
      return `/deals/${row.dealId}`;
    }
    case "contract": {
      await tx.contract.create({
        data: {
          ...(row as Prisma.ContractUncheckedCreateInput),
          templateId: await keep(row.templateId, (v) => tx.contractTemplate.findUnique({ where: { id: v }, select: { id: true } })),
          companyId: await keep(row.companyId, (v) => tx.company.findUnique({ where: { id: v }, select: { id: true } })),
          dealId: await keep(row.dealId, (v) => tx.deal.findUnique({ where: { id: v }, select: { id: true } })),
        },
      });
      return `/documents/contracts/${id}`;
    }
    case "lead": {
      // Сделка из лида возвращается к нему, только если её ещё не связали с другим лидом
      const dealId = await keep(row.dealId, (v) => tx.deal.findFirst({ where: { id: v, lead: null }, select: { id: true } }));
      const { raw, ...rest } = row;
      await tx.lead.create({
        data: { ...(rest as Prisma.LeadUncheckedCreateInput), dealId, ...(raw !== null && { raw: raw as Prisma.InputJsonValue }) },
      });
      return `/leads/${id}`;
    }
    case "knowledge": {
      await tx.knowledgeItem.create({ data: row as Prisma.KnowledgeItemUncheckedCreateInput });
      for (const f of s.children?.files ?? [])
        await tx.knowledgeFile.create({ data: { ...(f as Prisma.KnowledgeFileUncheckedCreateInput), data: Buffer.from(String(f.data), "base64") } });
      return `/documents/knowledge/${id}`;
    }
    case "product": {
      await tx.product.create({ data: row as Prisma.ProductUncheckedCreateInput });
      await relink(links.deals, (v) => tx.deal.updateMany({ where: { id: { in: v }, productId: null }, data: { productId: id } }));
      return "/price";
    }
  }
}

export async function restoreFromTrash(itemId: string) {
  const item = await db.trashItem.findUnique({ where: { id: itemId } });
  if (!item) throw new TrashError("Эта запись уже восстановлена или удалена из корзины");
  const kind = item.kind as TrashKind;
  if (!(kind in TRASH_KINDS)) throw new TrashError("Неизвестный тип записи");
  const href = await withoutActivity(() => db.$transaction(async (tx) => {
    const t = tx as unknown as Tx;
    const row = (item.data as unknown as Snapshot).row;
    const exists = await (t[kind === "knowledge" ? "knowledgeItem" : kind] as unknown as { findUnique: (a: object) => Promise<unknown> }).findUnique({ where: { id: row.id as string } });
    if (exists) throw new TrashError("Запись с таким id уже есть в CRM");
    const link = await restoreSnapshot(t, kind, item.data as unknown as Snapshot);
    await t.trashItem.delete({ where: { id: itemId } });
    return link;
  }));
  await logActivity({ section: item.section, kind: "restore", text: `${trashWording(kind, item.section).restored} ${quoted(kind, item.title)}`, href });
  return { href, section: item.section };
}
