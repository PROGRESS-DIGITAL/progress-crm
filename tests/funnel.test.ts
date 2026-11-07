import { test } from "node:test";
import assert from "node:assert/strict";
import { dealOutcomes, leadFunnel, percent, stageLoad, NO_REASON } from "../lib/funnel";

test("проценты", () => {
  assert.equal(percent(1, 3), 33);
  assert.equal(percent(0, 0), null);
});

test("заявки: до сделки и до оплаты", () => {
  const f = leadFunnel([
    { status: "CONVERTED", dealKind: "WON", rejectReason: null },
    { status: "CONVERTED", dealKind: "OPEN", rejectReason: null },
    { status: "CONVERTED", dealKind: null, rejectReason: null },
    { status: "REJECTED", dealKind: null, rejectReason: "Спам" },
    { status: "REJECTED", dealKind: null, rejectReason: "Спам" },
    { status: "NEW", dealKind: null, rejectReason: null },
  ]);
  assert.equal(f.total, 6);
  assert.equal(f.toDeal, 3);
  assert.equal(f.paid, 1);
  assert.equal(f.rejected, 2);
  assert.equal(f.open, 1);
  assert.deepEqual(f.rejectReasons, [{ reason: "Спам", count: 2, sum: 0 }]);
});

test("успешные и проигранные считаются от закрытых и дают 100%", () => {
  const d = (kind: "WON" | "LOST" | "OPEN", amount: number, lostReason: string | null = null, days = 10) => ({
    kind,
    amount,
    lostReason,
    startDate: new Date("2026-10-01T00:00:00Z"),
    closedAt: kind === "OPEN" ? null : new Date(Date.parse("2026-10-01T00:00:00Z") + days * 86_400_000),
  });
  const out = dealOutcomes([d("WON", 100, null, 10), d("WON", 200, null, 20), d("LOST", 50, "Дорого"), d("LOST", 70, ""), d("LOST", 30, "Дорого"), d("OPEN", 999)]);
  assert.equal(out.winRate, 40);
  assert.equal(out.lossRate, 60);
  assert.equal(out.open, 1);
  assert.equal(out.wonSum, 300);
  assert.equal(out.avgCycleDays, 15);
  assert.deepEqual(out.lostReasons, [
    { reason: "Дорого", count: 2, sum: 80 },
    { reason: NO_REASON, count: 1, sum: 70 },
  ]);
  assert.equal(dealOutcomes([d("OPEN", 1)]).winRate, null);
});

test("этап, где сделки стоят дольше всего", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  const ago = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const { rows, slowest } = stageLoad(
    [
      { id: "a", name: "Новая" },
      { id: "b", name: "КП отправлено" },
      { id: "c", name: "В работе" },
    ],
    [
      { stageId: "a", amount: 10, startDate: ago(2) },
      { stageId: "b", amount: 20, startDate: ago(30) },
      { stageId: "b", amount: 30, startDate: ago(10) },
    ],
    now,
  );
  assert.deepEqual(rows.map((r) => [r.count, r.sum, r.avgDays, r.maxDays]), [[1, 10, 2, 2], [2, 50, 20, 30], [0, 0, null, null]]);
  assert.equal(slowest, "b");
});
