import { db } from "@/lib/db";
import { dayKey } from "@/lib/calendar";
import type { LinkKind, LinkOption, LinkOptions, LinkRow, LinkTarget } from "@/lib/link-types";

export type { LinkKind, LinkOption, LinkOptions, LinkRow, LinkTarget } from "@/lib/link-types";

// Связи сделок, задач и встреч между собой (таблица EntityLink). Связь двусторонняя:
// видна в обеих карточках, порядок — по времени, когда её завели

type Deal = { id: string; title: string };
type Event = { id: string; title: string; kind: "MEETING" | "TASK"; start: Date };

const dealSelect = { id: true, title: true } as const;
const eventSelect = { id: true, title: true, kind: true, start: true } as const;

const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });

export const linkHref = (kind: LinkKind, id: string, start?: Date) =>
  kind === "DEAL" ? `/deals/${id}` : kind === "TASK" ? `/tasks/${id}` : `/calendar?view=day&date=${dayKey(start ?? new Date())}&open=${id}`;

function describe(deal: Deal | null, event: Event | null): Omit<LinkRow, "id"> | null {
  if (deal) return { kind: "DEAL", targetId: deal.id, title: deal.title, href: linkHref("DEAL", deal.id) };
  if (event) return { kind: event.kind, targetId: event.id, title: event.title, href: linkHref(event.kind, event.id, event.start) };
  return null;
}

const side = (t: LinkTarget, dir: "from" | "to"): Record<string, string> =>
  t.type === "deal" ? { [`${dir}DealId`]: t.id } : { [`${dir}EventId`]: t.id };

// Связи записи: вторая сторона каждой связи
export async function linksOf(t: LinkTarget): Promise<LinkRow[]> {
  return (await linksOfMany(t.type, [t.id])).get(t.id) ?? [];
}

// Связи сразу многих записей одного вида (например, всех событий недели в календаре)
export async function linksOfMany(type: LinkTarget["type"], ids: string[]): Promise<Map<string, LinkRow[]>> {
  const result = new Map<string, LinkRow[]>();
  if (!ids.length) return result;
  const [fromKey, toKey] = type === "deal" ? (["fromDealId", "toDealId"] as const) : (["fromEventId", "toEventId"] as const);
  const rows = await db.entityLink.findMany({
    where: { OR: [{ [fromKey]: { in: ids } }, { [toKey]: { in: ids } }] },
    orderBy: { createdAt: "asc" },
    include: { fromDeal: { select: dealSelect }, fromEvent: { select: eventSelect }, toDeal: { select: dealSelect }, toEvent: { select: eventSelect } },
  });
  const wanted = new Set(ids);
  const push = (id: string | null, other: Omit<LinkRow, "id"> | null, linkId: string) => {
    if (!id || !wanted.has(id) || !other) return;
    result.set(id, [...(result.get(id) ?? []), { id: linkId, ...other }]);
  };
  for (const r of rows) {
    push(r[fromKey], describe(r.toDeal, r.toEvent), r.id);
    push(r[toKey], describe(r.fromDeal, r.fromEvent), r.id);
  }
  return result;
}

// Что можно выбрать в «Связях»: сделки, задачи и встречи, свежие сверху
export async function linkOptions(): Promise<LinkOptions> {
  const [deals, tasks, meetings] = await Promise.all([
    db.deal.findMany({ orderBy: { updatedAt: "desc" }, take: 300, select: { ...dealSelect, company: { select: { name: true } } } }),
    db.event.findMany({ where: { kind: "TASK" }, orderBy: [{ done: "asc" }, { start: "desc" }], take: 300, select: { ...eventSelect, done: true } }),
    db.event.findMany({ where: { kind: "MEETING" }, orderBy: { start: "desc" }, take: 300, select: eventSelect }),
  ]);
  const opt = (kind: LinkKind, id: string, title: string, hint: string, start?: Date): LinkOption => ({ id, title, hint, href: linkHref(kind, id, start) });
  return {
    deals: deals.map((d) => opt("DEAL", d.id, d.title, d.company.name)),
    tasks: tasks.map((e) => opt("TASK", e.id, e.title, e.done ? "выполнена" : dateLabel.format(e.start).replace(".", ""), e.start)),
    meetings: meetings.map((e) => opt("MEETING", e.id, e.title, dateLabel.format(e.start).replace(".", ""), e.start)),
  };
}

async function exists(t: LinkTarget) {
  return t.type === "deal"
    ? !!(await db.deal.findUnique({ where: { id: t.id }, select: { id: true } }))
    : !!(await db.event.findUnique({ where: { id: t.id }, select: { id: true } }));
}

const same = (a: LinkTarget, b: LinkTarget) => a.type === b.type && a.id === b.id;

// Связать запись с другой. Повтор и связь с самой собой пропускаются; null — второй записи нет
export async function addLink(from: LinkTarget, to: LinkTarget): Promise<LinkRow | null> {
  if (same(from, to) || !(await exists(to)) || !(await exists(from))) return null;
  const pair = [{ ...side(from, "from"), ...side(to, "to") }, { ...side(to, "from"), ...side(from, "to") }];
  const found = await db.entityLink.findFirst({ where: { OR: pair }, select: { id: true } });
  if (!found) await db.entityLink.create({ data: pair[0] });
  return (await linksOf(from)).find((l) => l.targetId === to.id) ?? null;
}

// Новая запись: связи, выбранные в форме до сохранения
export async function addLinks(from: LinkTarget, targets: LinkTarget[]) {
  for (const to of targets) await addLink(from, to);
}

// Цели из формы: «deal:<id>», «event:<id>»
export function parseTargets(values: unknown[]): LinkTarget[] {
  return values.flatMap((v) => {
    const m = typeof v === "string" ? v.match(/^(deal|event):([\w-]{1,64})$/) : null;
    return m ? [{ type: m[1] as LinkTarget["type"], id: m[2] }] : [];
  });
}

// Новая запись из кнопки «Создать» (?fromDeal= или ?fromEvent=): заранее связана с карточкой, из которой её создают
export async function sourceLinks(fromDeal?: string, fromEvent?: string): Promise<LinkRow[]> {
  const [deal, event] = await Promise.all([
    fromDeal ? db.deal.findUnique({ where: { id: fromDeal }, select: dealSelect }) : null,
    !fromDeal && fromEvent ? db.event.findUnique({ where: { id: fromEvent }, select: eventSelect }) : null,
  ]);
  const row = describe(deal, event);
  return row ? [{ id: `draft:${row.targetId}`, ...row }] : [];
}
