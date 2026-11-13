import { test } from "node:test";
import assert from "node:assert/strict";
import { isFinalColumn } from "../lib/board-columns";

test("завершающий столбец узнаётся по названию", () => {
  for (const name of ["Выполнено", " выполнено ", "Готово", "Done", "Завершено"]) assert.equal(isFinalColumn(name), true, name);
  for (const name of ["В работе", "На проверке", "К выполнению", "Баги", "Релиз", "Не выполнено"]) assert.equal(isFinalColumn(name), false, name);
});
