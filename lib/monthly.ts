import type { StageKind } from "@prisma/client";

// Месяцы считаем по Москве: оплата 1-го числа в 01:00 не должна уйти в прошлый месяц
const TZ = "Europe/Moscow";

export type MonthKey = string; // YYYY-MM

export function monthKey(date: Date): MonthKey {
  return date.toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 7);
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export type MonthStats = {
  key: MonthKey;
  // Выручка: оплаченные сделки, закрытые в этом месяце
  revenue: number;
  paid: number;
  // Новые сделки по дате начала
  started: number;
  lost: number;
  avgCheck: number;
};

export type MonthDeal = { amount: number; kind: StageKind; startDate: Date; closedAt: Date | null };

export function monthlyStats(deals: MonthDeal[]): Map<MonthKey, MonthStats> {
  const map = new Map<MonthKey, MonthStats>();
  const get = (key: MonthKey) => {
    let m = map.get(key);
    if (!m) map.set(key, (m = { key, revenue: 0, paid: 0, started: 0, lost: 0, avgCheck: 0 }));
    return m;
  };
  for (const d of deals) {
    get(monthKey(d.startDate)).started++;
    if (!d.closedAt) continue;
    const m = get(monthKey(d.closedAt));
    if (d.kind === "WON") {
      m.revenue += d.amount;
      m.paid++;
    } else if (d.kind === "LOST") m.lost++;
  }
  for (const m of map.values()) m.avgCheck = m.paid ? Math.round(m.revenue / m.paid) : 0;
  return map;
}

export function emptyMonth(key: MonthKey): MonthStats {
  return { key, revenue: 0, paid: 0, started: 0, lost: 0, avgCheck: 0 };
}

// Изменение в процентах; null — сравнивать не с чем
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function monthLabel(key: MonthKey, short = false) {
  const [y, m] = key.split("-").map(Number);
  return short ? `${SHORT[m - 1]} ${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`;
}
