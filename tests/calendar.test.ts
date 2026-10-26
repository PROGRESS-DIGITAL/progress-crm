import { test } from "node:test";
import assert from "node:assert/strict";
import { coversDay, dayKey, fromKey, layoutDay, minutesOfDay, shift, viewDays, viewTitle, weekStart } from "../lib/calendar";

test("даты считаются по Москве", () => {
  assert.equal(dayKey(new Date("2026-10-26T21:30:00Z")), "2026-10-27");
  assert.equal(fromKey("2026-10-27", 9 * 60).toISOString(), "2026-10-27T06:00:00.000Z");
  assert.equal(minutesOfDay(new Date("2026-10-27T06:15:00Z")), 9 * 60 + 15);
});

test("неделя с понедельника, месяц целыми неделями", () => {
  assert.equal(weekStart("2026-11-01"), "2026-10-26");
  assert.equal(weekStart("2026-10-26"), "2026-10-26");
  const month = viewDays("month", "2026-10-15");
  assert.equal(month[0], "2026-09-28");
  assert.equal(month.at(-1), "2026-11-01");
  assert.equal(month.length % 7, 0);
  assert.equal(shift("month", "2026-01-31", 1), "2026-02-01");
  assert.equal(shift("month", "2026-01-10", -1), "2025-12-01");
});

test("заголовки видов", () => {
  assert.equal(viewTitle("month", "2026-10-26"), "Октябрь 2026");
  assert.equal(viewTitle("week", "2026-10-28"), "26 октября – 1 ноября 2026");
  assert.equal(viewTitle("week", "2026-10-14"), "12–18 октября 2026");
  assert.equal(viewTitle("day", "2026-10-26"), "Понедельник, 26 октября 2026 г.");
});

test("пересекающиеся встречи встают рядом", () => {
  const at = (h: number, m = 0) => fromKey("2026-10-26", h * 60 + m);
  const placed = layoutDay(
    [
      { id: "a", start: at(9), end: at(10) },
      { id: "b", start: at(9, 30), end: at(11) },
      { id: "c", start: at(10), end: at(10, 30) },
      { id: "d", start: at(12), end: at(13) },
    ],
    "2026-10-26",
  );
  const by = Object.fromEntries(placed.map((p) => [p.id, p]));
  assert.deepEqual([by.a.col, by.b.col, by.c.col], [0, 1, 0]);
  assert.equal(by.a.cols, 2);
  assert.equal(by.d.cols, 1);
  assert.equal(by.a.top, 540);
  assert.equal(by.b.height, 90);
});

test("событие через полночь обрезается по дню", () => {
  const e = { id: "x", start: fromKey("2026-10-26", 23 * 60), end: fromKey("2026-10-27", 60) };
  assert.deepEqual(layoutDay([e], "2026-10-27")[0], { id: "x", top: 0, height: 60, col: 0, cols: 1 });
  assert.ok(coversDay(e, "2026-10-26") && coversDay(e, "2026-10-27") && !coversDay(e, "2026-10-28"));
});
