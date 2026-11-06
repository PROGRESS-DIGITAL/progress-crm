"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { cardMoveActivity } from "@/lib/activity-text";
import { trashCard } from "@/lib/trash";

const refresh = () => revalidatePath("/tasks/board");

const name = z.string().trim().min(1, "Введите название").max(60, "Слишком длинное название");

// ——— Столбцы ———

export async function createColumn(): Promise<{ id: string }> {
  const last = await db.boardColumn.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const column = await db.boardColumn.create({ data: { name: "Новый столбец", order: (last?.order ?? 0) + 1 } });
  refresh();
  return { id: column.id };
}

export async function renameColumn(id: string, value: string): Promise<{ error?: string }> {
  const parsed = name.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.boardColumn.update({ where: { id }, data: { name: parsed.data } });
  refresh();
  return {};
}

// Карточки удаляемого столбца не пропадают: они переезжают в конец первого из оставшихся
export async function deleteColumn(id: string): Promise<{ error?: string }> {
  const columns = await db.boardColumn.findMany({ orderBy: { order: "asc" }, select: { id: true } });
  const target = columns.find((c) => c.id !== id);
  if (!target) return { error: "Последний столбец удалить нельзя" };
  await db.$transaction(async (tx) => {
    const last = await tx.boardCard.findFirst({ where: { columnId: target.id }, orderBy: { position: "desc" }, select: { position: true } });
    const cards = await tx.boardCard.findMany({ where: { columnId: id }, orderBy: { position: "asc" }, select: { id: true } });
    for (const [i, c] of cards.entries())
      await tx.boardCard.update({ where: { id: c.id }, data: { columnId: target.id, position: (last?.position ?? 0) + i + 1 } });
    await tx.boardColumn.delete({ where: { id } });
  });
  refresh();
  return {};
}

// ——— Карточки ———

const title = z.string().trim().min(1, "Введите название карточки").max(200, "Слишком длинное название");

// Новая карточка встаёт наверх столбца
export async function quickCreateCard(columnId: string, value: string): Promise<{ error?: string }> {
  const parsed = title.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await db.boardColumn.findUnique({ where: { id: columnId }, select: { id: true } }))) return { error: "Столбец удалён, обновите страницу" };
  const top = await db.boardCard.findFirst({ where: { columnId }, orderBy: { position: "asc" }, select: { position: true } });
  await db.boardCard.create({ data: { title: parsed.data, columnId, position: (top?.position ?? 1) - 1 } });
  refresh();
  return {};
}

const cardSchema = z.object({
  title,
  notes: z.string().trim().max(5000, "Слишком длинное описание").transform((v) => v || null),
  assigneeId: z.string().transform((v) => v || null),
});

export async function updateCard(id: string, input: { title: string; notes: string; assigneeId: string }): Promise<{ error?: string }> {
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { assigneeId } = parsed.data;
  if (assigneeId && !(await db.employee.findUnique({ where: { id: assigneeId }, select: { id: true } }))) return { error: "Сотрудник не найден" };
  await db.boardCard.update({ where: { id }, data: parsed.data });
  refresh();
  return {};
}

// order — id карточек столбца сверху вниз уже с перенесённой: позиции пересчитываются по нему
export async function moveCard(id: string, columnId: string, order: string[]) {
  const card = await db.boardCard.findUnique({ where: { id }, select: { id: true, title: true, columnId: true } });
  if (!card) return;
  const column = await db.boardColumn.findUnique({ where: { id: columnId }, select: { name: true } });
  if (!column) return;
  await db.boardCard.update({ where: { id }, data: { columnId } });
  await db.$transaction(order.map((cardId, position) => db.boardCard.updateMany({ where: { id: cardId, columnId }, data: { position } })));
  if (card.columnId !== columnId) await logActivity(cardMoveActivity(card, column.name));
  refresh();
}

export async function deleteCard(id: string) {
  await trashCard(id);
  refresh();
}
