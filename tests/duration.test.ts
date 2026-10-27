import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration } from "../lib/format";

test("formatDuration: минуты, часы и дни", () => {
  assert.equal(formatDuration(30), "0 мин");
  assert.equal(formatDuration(7 * 60 + 59), "7 мин");
  assert.equal(formatDuration(3 * 3600 + 5 * 60), "3 ч 05 мин");
  assert.equal(formatDuration(2 * 86400 + 3 * 3600 + 5 * 60), "2 д 3 ч 05 мин");
  assert.equal(formatDuration(-10), "0 мин");
});
