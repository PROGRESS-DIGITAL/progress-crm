import type { StageKind } from "@prisma/client";
import { monthKey, type MonthKey } from "@/lib/monthly";
import { percent } from "@/lib/funnel";

// Отчёт по менеджерам за месяц: выручка против плана, оплаченные и проигранные сделки, конверсия, что в работе.
// Менеджер — «Ответственный» в сделке; выручка считается по дате оплаты, как на вкладке «По месяцам»

export const PLAN_SETTING = "managers.plan";
export const NO_OWNER = "Без ответственного";
export const MAX_PLAN = 1_000_000_000;

// Ответственный → месяц, с которого действует план → сумма. План переносится на следующие месяцы, пока его не поменяют
export type Plans = Record<string, Record<MonthKey, number>>;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonthKey = (s: unknown): s is MonthKey => typeof s === "string" && MONTH_RE.test(s);

export function parsePlans(raw: string | null): Plans {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    const plans: Plans = {};
    if (!data || typeof data !== "object") return plans;
    for (const [owner, months] of Object.entries(data as Record<string, unknown>)) {
      if (!months || typeof months !== "object") continue;
      const clean: Record<MonthKey, number> = {};
      for (const [m, v] of Object.entries(months as Record<string, unknown>)) {
        if (isMonthKey(m) && Number.isInteger(v) && (v as number) >= 0) clean[m] = v as number;
      }
      if (Object.keys(clean).length) plans[owner] = clean;
    }
    return plans;
  } catch {
    return {};
  }
}

// План на месяц: последний заданный в этом месяце или раньше; 0 — плана нет
export function planFor(plans: Plans, owner: string, month: MonthKey) {
  const months = plans[owner];
  if (!months) return 0;
  const from = Object.keys(months)
    .filter((m) => m <= month)
    .sort()
    .at(-1);
  return from ? months[from] : 0;
}

// Новый план действует с этого месяца и дальше; более поздние планы остаются как были
export function setPlan(plans: Plans, owner: string, month: MonthKey, amount: number): Plans {
  const months = { ...plans[owner], [month]: amount };
  // Ноль без более раннего плана ничего не меняет: такую запись не храним
  const earlier = Object.keys(months).some((m) => m < month);
  if (amount === 0 && !earlier) delete months[month];
  const next = { ...plans };
  if (Object.keys(months).length) next[owner] = months;
  else delete next[owner];
  return next;
}

export type ManagerDeal = {
  owner: string | null;
  kind: StageKind;
  amount: number;
  startDate: Date;
  closedAt: Date | null;
  expectedCloseDate: Date | null;
};

export type ManagerRow = {
  owner: string;
  plan: number;
  revenue: number;
  // Доля плана в процентах; null — плана нет
  progress: number | null;
  won: number;
  lost: number;
  lostSum: number;
  // Оплаченные от закрытых за месяц
  winRate: number | null;
  avgCheck: number;
  started: number;
  startedSum: number;
  // Открытые сделки сейчас
  open: number;
  openSum: number;
  // Открытые сделки, которые ждём закрыть в этом месяце
  expected: number;
  expectedSum: number;
};

const SUMS = ["plan", "revenue", "won", "lost", "lostSum", "started", "startedSum", "open", "openSum", "expected", "expectedSum"] as const;

export const ownerKey = (owner: string | null) => owner?.trim() || NO_OWNER;

function emptyRow(owner: string, plan: number): ManagerRow {
  return {
    owner,
    plan,
    revenue: 0,
    progress: null,
    won: 0,
    lost: 0,
    lostSum: 0,
    winRate: null,
    avgCheck: 0,
    started: 0,
    startedSum: 0,
    open: 0,
    openSum: 0,
    expected: 0,
    expectedSum: 0,
  };
}

function finish(r: ManagerRow): ManagerRow {
  return {
    ...r,
    progress: r.plan > 0 ? percent(r.revenue, r.plan) : null,
    winRate: percent(r.won, r.won + r.lost),
    avgCheck: r.won ? Math.round(r.revenue / r.won) : 0,
  };
}

// Строки отчёта: менеджеры с планом или с движением по сделкам в этом месяце.
// Открытые сделки — это то, что в работе сейчас, поэтому для прошедших месяцев их не показываем
export function managerReport(deals: ManagerDeal[], month: MonthKey, plans: Plans, current: MonthKey) {
  const rows = new Map<string, ManagerRow>();
  const row = (owner: string) => {
    let r = rows.get(owner);
    if (!r) rows.set(owner, (r = emptyRow(owner, owner === NO_OWNER ? 0 : planFor(plans, owner, month))));
    return r;
  };
  for (const owner of Object.keys(plans)) if (planFor(plans, owner, month) > 0) row(owner);

  for (const d of deals) {
    const closedHere = d.closedAt !== null && monthKey(d.closedAt) === month;
    const startedHere = monthKey(d.startDate) === month;
    const open = d.kind === "OPEN" && month >= current;
    if (!closedHere && !startedHere && !open) continue;
    const r = row(ownerKey(d.owner));
    if (startedHere) {
      r.started++;
      r.startedSum += d.amount;
    }
    if (closedHere && d.kind === "WON") {
      r.won++;
      r.revenue += d.amount;
    }
    if (closedHere && d.kind === "LOST") {
      r.lost++;
      r.lostSum += d.amount;
    }
    if (open) {
      r.open++;
      r.openSum += d.amount;
      if (d.expectedCloseDate && monthKey(d.expectedCloseDate) === month) {
        r.expected++;
        r.expectedSum += d.amount;
      }
    }
  }

  const list = [...rows.values()]
    .map(finish)
    .sort(
      (a, b) =>
        Number(a.owner === NO_OWNER) - Number(b.owner === NO_OWNER) ||
        b.revenue - a.revenue ||
        b.plan - a.plan ||
        b.openSum - a.openSum ||
        a.owner.localeCompare(b.owner, "ru"),
    );

  const total = emptyRow("Вся команда", 0);
  for (const r of list) for (const k of SUMS) total[k] += r[k];
  return { rows: list, total: finish(total) };
}
