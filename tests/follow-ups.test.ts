import { test } from "node:test";
import assert from "node:assert/strict";
import { followUpDigest, followUpNotes, followUpRange } from "../lib/follow-ups";
import { fromKey } from "../lib/calendar";

test("какие оплаты пора поднять", () => {
  const { from, to } = followUpRange(fromKey("2026-11-20", 10 * 60), 30);
  // Оплата 21 октября (30 дней назад) входит, 22 октября — ещё рано, раньше 7 октября — слишком давно
  assert.equal(from.toISOString(), fromKey("2026-10-07").toISOString());
  assert.equal(to.toISOString(), fromKey("2026-10-22").toISOString());
  const paid = fromKey("2026-10-21", 15 * 60);
  assert.ok(paid >= from && paid < to);
  assert.ok(!(fromKey("2026-10-22", 9 * 60) < to));
});

test("текст задачи и сводки", () => {
  const notes = followUpNotes("Логотип для кофейни", 30, ["logoPassport", "brandbook", "landing", "businessSite"]);
  assert.match(notes, /30 дней назад оплачено «Логотип для кофейни»/);
  assert.match(notes, /дальше: Паспорт логотипа, Брендбук, Лендинг\./);
  const digest = followUpDigest([{ company: "Кофейня «Пример»", paid: "Логотип", steps: ["brandbook", "landing"] }]);
  assert.match(digest, /Пора предложить клиенту следующий шаг/);
  assert.match(digest, /Кофейня «Пример»: брендбук, лендинг \(оплачено «Логотип»\)/);
});
