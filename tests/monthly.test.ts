import { test } from "node:test";
import assert from "node:assert/strict";
import { change, monthKey, monthlyStats, shiftMonth } from "../lib/monthly";

test("месяц по Москве: 31-е 22:30 UTC — уже следующий месяц", () => {
  assert.equal(monthKey(new Date("2026-10-31T22:30:00Z")), "2026-11");
  assert.equal(monthKey(new Date("2026-10-31T20:00:00Z")), "2026-10");
});

test("сдвиг месяца через год", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-10", -12), "2025-10");
  assert.equal(shiftMonth("2025-12", 1), "2026-01");
});

test("выручка по дате оплаты, новые сделки по дате начала", () => {
  const stats = monthlyStats([
    { amount: 100, kind: "WON", startDate: new Date("2026-09-10"), closedAt: new Date("2026-10-05") },
    { amount: 300, kind: "WON", startDate: new Date("2026-10-01"), closedAt: new Date("2026-10-20") },
    { amount: 999, kind: "LOST", startDate: new Date("2026-10-02"), closedAt: new Date("2026-10-03") },
    { amount: 50, kind: "OPEN", startDate: new Date("2026-10-15"), closedAt: null },
  ]);
  const oct = stats.get("2026-10")!;
  assert.deepEqual(oct, { key: "2026-10", revenue: 400, paid: 2, started: 3, lost: 1, avgCheck: 200 });
  assert.equal(stats.get("2026-09")!.started, 1);
  assert.equal(stats.get("2026-09")!.revenue, 0);
});

test("изменение в процентах", () => {
  assert.equal(change(150, 100), 50);
  assert.equal(change(50, 100), -50);
  assert.equal(change(10, 0), null);
});
