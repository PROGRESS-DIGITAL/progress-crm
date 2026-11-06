import { test } from "node:test";
import assert from "node:assert/strict";
import { addCrmTime, formatCrmTime } from "../lib/format";

const at = (iso: string) => Date.parse(iso);

test("время в CRM копится, пока CRM открыта, и не считает перерывы", () => {
  let t = addCrmTime(null, at("2026-11-06T09:00:00+03:00"));
  assert.equal(t.total, 0);
  // Каждую секунду вкладка отмечается: за 90 минут набегает 01:30
  for (let s = 1; s <= 90 * 60; s++) t = addCrmTime(t, at("2026-11-06T09:00:00+03:00") + s * 1000);
  assert.equal(formatCrmTime(t.total), "01:30");
  // CRM закрыли на час: перерыв не идёт в счёт
  t = addCrmTime(t, at("2026-11-06T11:30:00+03:00"));
  t = addCrmTime(t, at("2026-11-06T11:30:01+03:00"));
  assert.equal(formatCrmTime(t.total), "01:30");
  // Вторая вкладка отмечается в ту же секунду: время не удваивается
  const same = addCrmTime(t, t.last);
  assert.equal(same.total, t.total);
});

test("время в CRM: в полночь по Москве счёт начинается заново", () => {
  const evening = { day: "2026-11-05", total: 5 * 3_600_000, last: at("2026-11-05T22:00:00+03:00") };
  assert.equal(addCrmTime(evening, at("2026-11-06T09:00:00+03:00")).total, 0);
  // Вкладка открыта через полночь: новый день считаем с 00:00
  const late = { day: "2026-11-05", total: 5 * 3_600_000, last: at("2026-11-05T23:59:59+03:00") };
  assert.equal(addCrmTime(late, at("2026-11-06T00:00:01+03:00")).total, 1000);
  assert.equal(formatCrmTime(23 * 3_600_000 + 59 * 60_000 + 59_000), "23:59");
});
