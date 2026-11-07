import { test } from "node:test";
import assert from "node:assert/strict";
import { staleDays, staleDigestText } from "../lib/stale-deals";
import { daysLabel } from "../lib/format";

const now = new Date("2026-11-20T09:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

test("сделка без движения неделю и дольше", () => {
  assert.equal(staleDays({ planned: false, dates: [ago(10), ago(8)] }, now), 8);
  assert.equal(staleDays({ planned: false, dates: [ago(10), ago(3)] }, now), null);
  assert.equal(staleDays({ planned: false, dates: [ago(7)] }, now), 7);
  // Запланированная задача — сделкой занимаются
  assert.equal(staleDays({ planned: true, dates: [ago(30)] }, now), null);
  // Нет переписки и писем — считаем по остальным датам
  assert.equal(staleDays({ planned: false, dates: [ago(9), null, undefined] }, now), 9);
});

test("склонение дней", () => {
  assert.deepEqual([1, 2, 5, 11, 12, 21, 22, 25].map(daysLabel), ["1 день", "2 дня", "5 дней", "11 дней", "12 дней", "21 день", "22 дня", "25 дней"]);
});

test("сводка в Telegram", () => {
  const deals = Array.from({ length: 12 }, (_, i) => ({ title: `Сайт ${i + 1}`, company: "ООО «Пример»", amount: 100000, days: 20 - i }));
  const text = staleDigestText(deals);
  assert.match(text, /Сделки без движения: 12/);
  assert.match(text, /Сайт 1 \(ООО «Пример»\), 100\s000\s₽, 20 дней/);
  assert.match(text, /…и ещё 2/);
});
