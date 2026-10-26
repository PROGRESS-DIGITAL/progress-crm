import { test } from "node:test";
import assert from "node:assert/strict";
import { fromKey } from "../lib/calendar";
import { cleanFileName, fileSize, inlineType, taskBucket, taskPeriod } from "../lib/tasks";

const now = fromKey("2026-10-28", 12 * 60);

test("taskBucket: просроченные, сегодняшние, будущие и выполненные", () => {
  const day = (a: string, b: string) => ({ start: fromKey(a), end: fromKey(b), done: false });
  assert.equal(taskBucket(day("2026-10-26", "2026-10-28"), now), "overdue");
  assert.equal(taskBucket(day("2026-10-27", "2026-10-29"), now), "today");
  assert.equal(taskBucket(day("2026-10-28", "2026-10-29"), now), "today");
  assert.equal(taskBucket(day("2026-10-29", "2026-10-30"), now), "upcoming");
  assert.equal(taskBucket({ ...day("2026-10-01", "2026-10-02"), done: true }, now), "done");
});

test("taskPeriod: один день и диапазон", () => {
  assert.equal(taskPeriod({ start: fromKey("2026-10-28"), end: fromKey("2026-10-29"), allDay: true }), "28 окт.");
  assert.equal(
    taskPeriod({ start: fromKey("2026-10-28"), end: fromKey("2026-11-03"), allDay: true }),
    "28 окт. – 2 нояб.",
  );
  assert.equal(taskPeriod({ start: fromKey("2026-10-28", 600), end: fromKey("2026-10-28", 660), allDay: false }), "28 окт.");
});

test("fileSize и cleanFileName", () => {
  assert.equal(fileSize(500), "500 Б");
  assert.equal(fileSize(2048), "2 КБ");
  assert.equal(fileSize(3.5 * 1024 * 1024), "3,5 МБ");
  assert.equal(cleanFileName("C:\\fakepath\\ТЗ.docx"), "ТЗ.docx");
  assert.equal(cleanFileName("../../a\u0000b.pdf"), "ab.pdf");
  const long = cleanFileName("я".repeat(300) + ".pdf");
  assert.equal(long.length, 200);
  assert.ok(long.endsWith(".pdf"));
});

test("inlineType: картинки и pdf открываются, остальное скачивается", () => {
  assert.ok(inlineType("image/png"));
  assert.ok(inlineType("application/pdf"));
  assert.ok(!inlineType("text/html"));
  assert.ok(!inlineType("image/svg+xml"));
});
