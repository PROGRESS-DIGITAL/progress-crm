import { test } from "node:test";
import assert from "node:assert/strict";
import { crmTimeToday } from "../lib/format";

const at = (iso: string) => Date.parse(iso);

test("crmTimeToday: часы и минуты с запуска", () => {
  assert.equal(crmTimeToday(at("2026-10-27T12:32:00+03:00"), at("2026-10-27T09:00:00+03:00")), "03:32");
  assert.equal(crmTimeToday(at("2026-10-27T09:00:59+03:00"), at("2026-10-27T09:00:00+03:00")), "00:00");
});

test("crmTimeToday: в полночь по Москве счёт начинается заново", () => {
  // Компьютер включили вчера: считаем только с 00:00 сегодняшнего дня
  assert.equal(crmTimeToday(at("2026-10-27T12:32:00+03:00"), at("2026-10-25T18:00:00+03:00")), "12:32");
  assert.equal(crmTimeToday(at("2026-10-28T00:00:30+03:00"), at("2026-10-27T08:00:00+03:00")), "00:00");
  assert.equal(crmTimeToday(at("2026-10-27T23:59:00+03:00"), at("2026-10-27T00:00:00+03:00")), "23:59");
});
