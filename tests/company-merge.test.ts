import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeFields } from "../lib/company-merge";

test("заполненное у основного клиента остаётся, пустое берётся у второго", () => {
  const merged = mergeFields(
    { name: "ООО «Ромашка»", inn: "7707083893", phone: null, email: "" },
    { name: "Ромашка", inn: "7707083893", phone: "+7 900 000-00-00", email: "hi@romashka.ru", kpp: "773601001" },
  );
  assert.equal(merged.name, "ООО «Ромашка»");
  assert.equal(merged.phone, "+7 900 000-00-00");
  assert.equal(merged.email, "hi@romashka.ru");
  assert.equal(merged.kpp, "773601001");
});

test("разные заметки складываются, одинаковые не дублируются", () => {
  assert.equal(mergeFields({ name: "А", notes: "Звонить утром" }, { name: "А", notes: "Любит Telegram" }).notes, "Звонить утром\n\nЛюбит Telegram");
  assert.equal(mergeFields({ name: "А", notes: "Одно" }, { name: "А", notes: "Одно" }).notes, "Одно");
});

test("пустое название основного не затирает название", () => {
  assert.equal(mergeFields({ name: "" }, { name: "Второй" }).name, "Второй");
  assert.equal(mergeFields({}, {}).name, undefined);
});
