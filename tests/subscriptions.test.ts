import { test } from "node:test";
import assert from "node:assert/strict";
import { activeIn, billingDayKey, invoiceReminderText, isDue, monthlyTotal, periodTitle } from "../lib/subscriptions";
import { fromKey } from "../lib/calendar";

const base = { startMonth: "2026-10", endMonth: null, active: true, billingDay: 5 };

test("абонемент действует в месяцах от начала до конца", () => {
  assert.equal(activeIn(base, "2026-09"), false);
  assert.equal(activeIn(base, "2026-10"), true);
  assert.equal(activeIn(base, "2027-03"), true);
  assert.equal(activeIn({ ...base, endMonth: "2026-12" }, "2027-01"), false);
  assert.equal(activeIn({ ...base, active: false }, "2026-11"), false);
});

test("день счёта", () => {
  assert.equal(billingDayKey("2026-11", 5), "2026-11-05");
  assert.equal(billingDayKey("2026-02", 31), "2026-02-28");
  // До дня счёта сделка месяца не заводится, с этого дня по Москве — да
  assert.equal(isDue(base, fromKey("2026-11-04", 23 * 60)), false);
  assert.equal(isDue(base, fromKey("2026-11-05", 10)), true);
  assert.equal(isDue(base, fromKey("2026-11-20")), true);
  assert.equal(isDue({ ...base, startMonth: "2026-12" }, fromKey("2026-11-20")), false);
});

test("сумма абонементов за месяц", () => {
  const subs = [
    { ...base, amount: 30000 },
    { ...base, amount: 20000, endMonth: "2026-10" },
    { ...base, amount: 15000, active: false },
  ];
  assert.equal(monthlyTotal(subs, "2026-10"), 50000);
  assert.equal(monthlyTotal(subs, "2026-11"), 30000);
});

test("названия и текст напоминания", () => {
  assert.equal(periodTitle("SEO-продвижение", "2026-11"), "SEO-продвижение · ноябрь 2026");
  const text = invoiceReminderText([{ company: "ООО «Пример»", title: "SEO", amount: 30000, month: "2026-11", dealId: "d1" }]);
  assert.match(text, /Пора выставить счёт по LTV-платежу/);
  assert.match(text, /ООО «Пример»: SEO, 30\s000\s₽/);
});
