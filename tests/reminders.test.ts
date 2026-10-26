import { test } from "node:test";
import assert from "node:assert/strict";
import { fromKey } from "../lib/calendar";
import { linkCode, reminderText, remindAt } from "../lib/reminders";

test("время напоминания", () => {
  const start = fromKey("2026-10-27", 11 * 60);
  assert.equal(remindAt({ start, allDay: false, remindMinutes: 15 })?.toISOString(), "2026-10-27T07:45:00.000Z");
  assert.equal(remindAt({ start, allDay: false, remindMinutes: null }), null);
  // Весь день: в 9:00 по Москве в этот день или накануне
  const day = fromKey("2026-10-30");
  assert.equal(remindAt({ start: day, allDay: true, remindMinutes: 15 })?.toISOString(), "2026-10-30T06:00:00.000Z");
  assert.equal(remindAt({ start: day, allDay: true, remindMinutes: 1440 })?.toISOString(), "2026-10-29T06:00:00.000Z");
});

test("команда привязки из ссылки", () => {
  assert.equal(linkCode("/start crm-a1b2c3d4e5f6"), "a1b2c3d4e5f6");
  assert.equal(linkCode("/start"), null);
  assert.equal(linkCode("привет"), null);
});

test("текст напоминания", () => {
  const start = fromKey("2026-10-27", 11 * 60);
  const text = reminderText(
    { kind: "MEETING", title: "Созвон по SEO", start, end: fromKey("2026-10-27", 12 * 60), allDay: false, remindMinutes: 15, notes: null },
    { company: "АвтоСервис 24", deal: "Директ на 3 месяца" },
    fromKey("2026-10-27", 10 * 60 + 45),
  );
  assert.equal(text, "⏰ Через 15 мин: Созвон по SEO\nвт, 27 октября, 11:00–12:00\nКлиент: АвтоСервис 24\nСделка: Директ на 3 месяца");
  const task = reminderText(
    { kind: "TASK", title: "Подготовить КП", start, end: start, allDay: false, remindMinutes: 0, notes: "Цены из прайса" },
    {},
    start,
  );
  assert.equal(task, "⏰ Сейчас: задача «Подготовить КП»\nвт, 27 октября, 11:00–11:00\n\nЦены из прайса");
});
