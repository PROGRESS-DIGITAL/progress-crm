import type { LeadStatus, StageKind } from "@prisma/client";

// Воронка продаж: сколько заявок дошло до сделки и до оплаты, доля выигранных и проигранных сделок,
// причины проигрыша и где сейчас стоят открытые сделки

export const PERIODS = [
  { value: "3", label: "3 месяца", months: 3 },
  { value: "6", label: "Полгода", months: 6 },
  { value: "12", label: "Год", months: 12 },
  { value: "all", label: "Всё время", months: null },
] as const;
export type PeriodValue = (typeof PERIODS)[number]["value"];
export const DEFAULT_PERIOD: PeriodValue = "12";

const DAY = 86_400_000;
export const NO_REASON = "Не указана";

export type FunnelLead = { status: LeadStatus; dealKind: StageKind | null; rejectReason: string | null };
export type FunnelDeal = {
  kind: StageKind;
  amount: number;
  startDate: Date;
  closedAt: Date | null;
  lostReason: string | null;
};
export type OpenDeal = { stageId: string; amount: number; startDate: Date };
export type FunnelStage = { id: string; name: string };

// Доля в процентах, округлённая; null — делить не на что
export function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function byReason<T>(items: T[], reason: (t: T) => string | null, amount: (t: T) => number = () => 0) {
  const map = new Map<string, { reason: string; count: number; sum: number }>();
  for (const it of items) {
    const key = reason(it)?.trim() || NO_REASON;
    const row = map.get(key) ?? { reason: key, count: 0, sum: 0 };
    row.count++;
    row.sum += amount(it);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.sum - a.sum);
}

export function leadFunnel(leads: FunnelLead[]) {
  const toDeal = leads.filter((l) => l.dealKind !== null || l.status === "CONVERTED").length;
  const paid = leads.filter((l) => l.dealKind === "WON").length;
  const rejected = leads.filter((l) => l.status === "REJECTED");
  return {
    total: leads.length,
    toDeal,
    paid,
    rejected: rejected.length,
    open: leads.filter((l) => l.status === "NEW" || l.status === "IN_PROGRESS").length,
    rejectReasons: byReason(rejected, (l) => l.rejectReason),
  };
}

// Сделки, начатые за период, и чем они закончились. Успешные и проигранные считаются от закрытых
export function dealOutcomes(deals: FunnelDeal[]) {
  const won = deals.filter((d) => d.kind === "WON");
  const lost = deals.filter((d) => d.kind === "LOST");
  const open = deals.filter((d) => d.kind === "OPEN");
  const closed = won.length + lost.length;
  const winRate = percent(won.length, closed);
  const cycles = won.filter((d) => d.closedAt).map((d) => Math.max(0, (d.closedAt!.getTime() - d.startDate.getTime()) / DAY));
  const sum = (ds: FunnelDeal[]) => ds.reduce((a, d) => a + d.amount, 0);
  return {
    total: deals.length,
    won: won.length,
    lost: lost.length,
    open: open.length,
    wonSum: sum(won),
    lostSum: sum(lost),
    openSum: sum(open),
    winRate,
    // Вместе с успешными всегда даёт 100%
    lossRate: winRate === null ? null : 100 - winRate,
    avgCycleDays: cycles.length ? Math.round(cycles.reduce((a, c) => a + c, 0) / cycles.length) : null,
    lostReasons: byReason(lost, (d) => d.lostReason, (d) => d.amount),
  };
}

// Открытые сделки по этапам сейчас: сколько их и сколько дней в среднем они уже в работе
export function stageLoad(stages: FunnelStage[], deals: OpenDeal[], now: Date) {
  const rows = stages.map((s) => {
    const here = deals.filter((d) => d.stageId === s.id);
    const ages = here.map((d) => Math.max(0, Math.floor((now.getTime() - d.startDate.getTime()) / DAY)));
    return {
      ...s,
      count: here.length,
      sum: here.reduce((a, d) => a + d.amount, 0),
      avgDays: ages.length ? Math.round(ages.reduce((a, x) => a + x, 0) / ages.length) : null,
      maxDays: ages.length ? Math.max(...ages) : null,
    };
  });
  // Узкое место: этап, где сделки в среднем стоят дольше всего
  const busy = rows.filter((r) => r.avgDays !== null);
  const slowest = busy.length > 1 ? busy.reduce((a, r) => (r.avgDays! > a.avgDays! ? r : a)).id : null;
  return { rows, slowest };
}
