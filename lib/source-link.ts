import { db } from "@/lib/db";
import { dayKey } from "@/lib/calendar";

// Связь «создано из»: сделка, задача или встреча, из карточки которой кнопкой «Создать» завели новую
export type SourceRef = { kind: "DEAL" | "TASK" | "MEETING"; title: string; href: string };
// id источника, которые форма передаёт при создании; у новой записи заполнено одно из двух
export type SourceIds = { sourceDealId: string; sourceEventId: string };

export const sourceInclude = {
  sourceDeal: { select: { id: true, title: true } },
  sourceEvent: { select: { id: true, title: true, kind: true, start: true } },
} as const;

type WithSource = {
  sourceDeal?: { id: string; title: string } | null;
  sourceEvent?: { id: string; title: string; kind: "MEETING" | "TASK"; start: Date } | null;
};

export function sourceRef({ sourceDeal, sourceEvent }: WithSource): SourceRef | null {
  if (sourceDeal) return { kind: "DEAL", title: sourceDeal.title, href: `/deals/${sourceDeal.id}` };
  if (sourceEvent)
    return sourceEvent.kind === "TASK"
      ? { kind: "TASK", title: sourceEvent.title, href: `/tasks/${sourceEvent.id}` }
      : { kind: "MEETING", title: sourceEvent.title, href: `/calendar?view=day&date=${dayKey(sourceEvent.start)}&open=${sourceEvent.id}` };
  return null;
}

// Источник из ссылки «Создать» (?fromDeal= или ?fromEvent=): проверяем, что он есть, и готовим подпись
export async function loadSource(fromDeal?: string, fromEvent?: string): Promise<{ ids: SourceIds; ref: SourceRef | null }> {
  const [sourceDeal, sourceEvent] = await Promise.all([
    fromDeal ? db.deal.findUnique({ where: { id: fromDeal }, select: sourceInclude.sourceDeal.select }) : null,
    !fromDeal && fromEvent ? db.event.findUnique({ where: { id: fromEvent }, select: sourceInclude.sourceEvent.select }) : null,
  ]);
  return {
    ids: { sourceDealId: sourceDeal?.id ?? "", sourceEventId: sourceEvent?.id ?? "" },
    ref: sourceRef({ sourceDeal, sourceEvent }),
  };
}

// Перед сохранением новой записи: источник мог исчезнуть, пока форма была открыта
export async function checkedSource(ids: Partial<SourceIds> | undefined) {
  const [deal, event] = await Promise.all([
    ids?.sourceDealId ? db.deal.findUnique({ where: { id: ids.sourceDealId }, select: { id: true } }) : null,
    ids?.sourceEventId ? db.event.findUnique({ where: { id: ids.sourceEventId }, select: { id: true } }) : null,
  ]);
  return { sourceDealId: deal?.id ?? null, sourceEventId: deal ? null : (event?.id ?? null) };
}
