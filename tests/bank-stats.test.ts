import { test } from "node:test";
import assert from "node:assert/strict";
import { bankMonthlyStats, topPayers } from "../lib/bank-stats";

const pay = (date: string, amount: number, payerInn: string | null, payerName: string | null, documentId: string | null = null) => ({
  date: new Date(date),
  amount,
  payerInn,
  payerName,
  documentId,
});

const rows = [
  pay("2026-10-01T12:00:00+03:00", 50000, "7701234567", "ООО Ромашка", "doc1"),
  pay("2026-10-15T12:00:00+03:00", 30000, "7701234567", "ООО \"Ромашка\""),
  pay("2026-10-20T12:00:00+03:00", 20000, null, "ИП Петров"),
  // 31 октября 23:30 по Москве — ещё октябрь, хотя по UTC это тоже 31-е; 1 ноября 01:00 по Москве — уже ноябрь
  pay("2026-10-31T23:30:00+03:00", 1000, null, "ип петров "),
  pay("2026-11-01T01:00:00+03:00", 5000, "500100732259", "Пекарня"),
];

test("поступления по месяцам", () => {
  const stats = bankMonthlyStats(rows);
  const oct = stats.get("2026-10")!;
  assert.equal(oct.total, 101000);
  assert.equal(oct.count, 4);
  assert.equal(oct.avg, 25250);
  assert.equal(oct.payers, 2);
  assert.equal(oct.matched, 50000);
  assert.equal(oct.unmatched, 51000);
  assert.equal(stats.get("2026-11")!.total, 5000);
});

test("крупнейшие плательщики", () => {
  const top = topPayers(rows, 2);
  assert.deepEqual(
    top.map((t) => [t.name, t.total, t.count]),
    [
      ["ООО Ромашка", 80000, 2],
      ["ИП Петров", 21000, 2],
    ],
  );
});
