"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { addDays, fromKey, isDayKey } from "@/lib/calendar";
import { getOwner } from "@/lib/profile";
import { REMIND_OPTIONS } from "@/lib/reminders";

export type EventInput = {
  kind: "MEETING" | "TASK";
  title: string;
  notes: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  done: boolean;
  clientName: string;
  // id сделки, "" без сделки или "new" — создать новую с названием newDealTitle
  dealId: string;
  newDealTitle: string;
  taskId: string;
  // Минуты до начала для напоминания в Telegram; "" — не напоминать
  remindMinutes: string;
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Время в формате ЧЧ:ММ");
const day = z.string().refine(isDayKey, "Укажите дату");
const schema = z.object({
  kind: z.enum(["MEETING", "TASK"]),
  title: z.string().trim().min(1, "Укажите название").max(200, "Слишком длинное название"),
  notes: z.string().trim().max(5000, "Слишком длинные заметки"),
  date: day,
  endDate: day,
  startTime: time,
  endTime: time,
  allDay: z.boolean(),
  done: z.boolean(),
  clientName: z.string().trim().max(200, "Слишком длинное название клиента"),
  dealId: z.string(),
  newDealTitle: z.string().trim().max(200, "Слишком длинное название сделки"),
  taskId: z.string(),
  remindMinutes: z
    .string()
    .refine((v) => v === "" || REMIND_OPTIONS.some((o) => String(o.value) === v), "Неизвестное время напоминания"),
});

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

function revalidate(companyId?: string | null, dealId?: string | null) {
  revalidatePath("/calendar");
  revalidatePath("/tasks");
  if (companyId) revalidatePath(`/clients/${companyId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);
}

// Клиент ищется по названию, а если такого нет — создаётся: так встречу с новым клиентом можно завести прямо из календаря
async function resolveCompany(name: string) {
  if (!name) return null;
  const found = await db.company.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  return (found ?? (await db.company.create({ data: { name }, select: { id: true } }))).id;
}

async function createDeal(title: string, companyId: string) {
  const stage = await db.stage.findFirst({ where: { kind: "OPEN" }, orderBy: { order: "asc" }, select: { id: true } });
  if (!stage) throw new Error("В воронке нет открытых этапов");
  const top = await db.deal.findFirst({ where: { stageId: stage.id }, orderBy: { position: "asc" }, select: { position: true } });
  const deal = await db.deal.create({
    data: { title, companyId, stageId: stage.id, owner: (await getOwner()).name, position: (top?.position ?? 1) - 1 },
    select: { id: true },
  });
  revalidatePath("/deals");
  return deal.id;
}

export async function saveEvent(id: string | null, input: EventInput): Promise<{ error?: string; id?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  let start: Date;
  let end: Date;
  if (v.allDay) {
    if (v.endDate < v.date) return { error: "Дата окончания раньше даты начала" };
    start = fromKey(v.date);
    end = fromKey(addDays(v.endDate, 1));
  } else {
    start = fromKey(v.date, minutes(v.startTime));
    end = fromKey(v.date, minutes(v.endTime));
    if (end <= start) return { error: "Окончание должно быть позже начала" };
  }

  let companyId = await resolveCompany(v.clientName);
  let dealId: string | null = null;
  if (v.dealId === "new") {
    if (!companyId) return { error: "Для новой сделки укажите клиента" };
    dealId = await createDeal(v.newDealTitle || v.title, companyId);
  } else if (v.dealId) {
    const deal = await db.deal.findUnique({ where: { id: v.dealId }, select: { id: true, companyId: true } });
    if (!deal) return { error: "Сделка не найдена, обновите страницу" };
    // Сделка всегда принадлежит своему клиенту: событие привязывается к нему же
    dealId = deal.id;
    companyId = deal.companyId;
  }

  let taskId: string | null = null;
  if (v.taskId) {
    if (v.taskId === id) return { error: "Задачу нельзя связать с самой собой" };
    const task = await db.event.findUnique({ where: { id: v.taskId }, select: { kind: true } });
    if (task?.kind !== "TASK") return { error: "Задача не найдена, обновите страницу" };
    taskId = v.taskId;
  }

  const data = {
    kind: v.kind,
    title: v.title,
    notes: v.notes || null,
    start,
    end,
    allDay: v.allDay,
    done: v.kind === "TASK" && v.done,
    companyId,
    dealId,
    taskId,
    remindMinutes: v.remindMinutes === "" ? null : Number(v.remindMinutes),
  };
  const before = id
    ? await db.event.findUnique({ where: { id }, select: { companyId: true, dealId: true, start: true, remindMinutes: true } })
    : null;
  if (id && !before) return { error: "Событие уже удалено" };
  // Перенесли событие или поменяли напоминание — напомнить заново
  const remindAgain = !before || before.start.getTime() !== start.getTime() || before.remindMinutes !== data.remindMinutes;
  const saved = id
    ? await db.event.update({ where: { id }, data: { ...data, ...(remindAgain && { remindedAt: null }) }, select: { id: true } })
    : await db.event.create({ data, select: { id: true } });
  revalidate(companyId, dealId);
  revalidate(before?.companyId, before?.dealId);
  return { id: saved.id };
}

// Перетаскивание в сетке: сохраняется новое время, длительность прежняя
export async function moveEvent(id: string, startIso: string): Promise<{ error?: string }> {
  const event = await db.event.findUnique({ where: { id } });
  if (!event) return { error: "Событие уже удалено" };
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return { error: "Некорректное время" };
  const end = new Date(start.getTime() + (event.end.getTime() - event.start.getTime()));
  await db.event.update({ where: { id }, data: { start, end, remindedAt: null } });
  revalidate(event.companyId, event.dealId);
  return {};
}

export async function toggleDone(id: string) {
  const event = await db.event.findUnique({ where: { id }, select: { done: true, companyId: true, dealId: true } });
  if (!event) return;
  await db.event.update({ where: { id }, data: { done: !event.done } });
  revalidate(event.companyId, event.dealId);
}

export async function deleteEvent(id: string): Promise<{ error?: string }> {
  const event = await db.event.findUnique({ where: { id }, select: { companyId: true, dealId: true } });
  if (!event) return {};
  await db.event.delete({ where: { id } });
  revalidate(event.companyId, event.dealId);
  return {};
}
