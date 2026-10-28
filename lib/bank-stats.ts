import { monthKey, type MonthKey } from "@/lib/monthly";

export type BankPaymentRow = { date: Date; amount: number; payerName: string | null; payerInn: string | null; documentId: string | null };

export type BankMonth = {
  key: MonthKey;
  total: number;
  count: number;
  avg: number;
  payers: number;
  // Сколько пришло по счетам из CRM и сколько без счёта (оплаты по ссылке, возвраты, прочие поступления)
  matched: number;
  unmatched: number;
};

export function emptyBankMonth(key: MonthKey): BankMonth {
  return { key, total: 0, count: 0, avg: 0, payers: 0, matched: 0, unmatched: 0 };
}

const payerKey = (p: BankPaymentRow) => p.payerInn || p.payerName?.trim().toLowerCase() || "—";

// Поступления по месяцам по дате зачисления (Москва)
export function bankMonthlyStats(payments: BankPaymentRow[]) {
  const months = new Map<MonthKey, BankMonth & { payerSet: Set<string> }>();
  for (const p of payments) {
    const key = monthKey(p.date);
    const m = months.get(key) ?? { ...emptyBankMonth(key), payerSet: new Set<string>() };
    m.total += p.amount;
    m.count++;
    m.payerSet.add(payerKey(p));
    if (p.documentId) m.matched += p.amount;
    else m.unmatched += p.amount;
    months.set(key, m);
  }
  return new Map(
    [...months].map(([key, { payerSet, ...m }]) => [key, { ...m, payers: payerSet.size, avg: Math.round(m.total / m.count) }]),
  );
}

// Кто больше всех заплатил за период: ИНН объединяет платежи с разным написанием названия
export function topPayers(payments: BankPaymentRow[], limit = 10) {
  const by = new Map<string, { name: string; inn: string | null; total: number; count: number }>();
  for (const p of payments) {
    const key = payerKey(p);
    const row = by.get(key) ?? { name: p.payerName?.trim() || "Без названия", inn: p.payerInn, total: 0, count: 0 };
    row.total += p.amount;
    row.count++;
    by.set(key, row);
  }
  return [...by.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}
