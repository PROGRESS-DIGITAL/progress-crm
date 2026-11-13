"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { taskMoveActivity } from "@/lib/activity-text";
import { addDays, dayKey, fromKey } from "@/lib/calendar";
import { isFinalColumn } from "@/lib/board-columns";

// Доски видны и в меню слева, а задачи основной доски — в списке и календаре
const refresh = () => {
  revalidatePath("/", "layout");
};

const name = z.string().trim().min(1, "Введите название").max(60, "Слишком длинное название");

// ——— Доски ———

export async function createBoard(): Promise<{ id: string }> {
  const last = await db.board.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const board = await db.board.create({
    data: {
      name: "Новая доска",
      order: (last?.order ?? 0) + 1,
      columns: { create: [{ name: "Бэклог", order: 1 }, { name: "В работе", order: 2 }, { name: "Готово", order: 3 }] },
    },
  });
  refresh();
  return { id: board.id };
}

export async function renameBoard(id: string, value: string): Promise<{ error?: string }> {
  const parsed = name.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.board.update({ where: { id }, data: { name: parsed.data } });
  refresh();
  return {};
}

// Задачи удаляемой доски не пропадают: они переезжают на основную доску, в её первый столбец
export async function deleteBoard(id: string): Promise<{ error?: string }> {
  const board = await db.board.findUnique({ where: { id }, select: { main: true } });
  if (!board) return {};
  if (board.main) return { error: "Основную доску удалить нельзя" };
  await db.$transaction([
    db.event.updateMany({ where: { column: { boardId: id } }, data: { columnId: null } }),
    db.board.delete({ where: { id } }),
  ]);
  refresh();
  return {};
}

// ——— Столбцы ———

export async function createColumn(boardId: string): Promise<{ id: string }> {
  const last = await db.boardColumn.findFirst({ where: { boardId }, orderBy: { order: "desc" }, select: { order: true } });
  const column = await db.boardColumn.create({ data: { boardId, name: "Новый столбец", order: (last?.order ?? 0) + 1 } });
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

// Задачи удаляемого столбца переезжают в конец первого из оставшихся на той же доске
export async function deleteColumn(id: string): Promise<{ error?: string }> {
  const column = await db.boardColumn.findUnique({ where: { id }, select: { boardId: true } });
  if (!column) return {};
  const columns = await db.boardColumn.findMany({ where: { boardId: column.boardId }, orderBy: { order: "asc" }, select: { id: true } });
  const target = columns.find((c) => c.id !== id);
  if (!target) return { error: "Последний столбец удалить нельзя" };
  // У основной доски задачи без столбца стоят в первом: если удалить его, они сами окажутся в новом первом
  await db.$transaction(async (tx) => {
    const last = await tx.event.findFirst({ where: { columnId: target.id }, orderBy: { position: "desc" }, select: { position: true } });
    const tasks = await tx.event.findMany({ where: { columnId: id }, orderBy: { position: "asc" }, select: { id: true } });
    for (const [i, t] of tasks.entries())
      await tx.event.update({ where: { id: t.id }, data: { columnId: target.id, position: (last?.position ?? 0) + i + 1 } });
    await tx.boardColumn.delete({ where: { id } });
  });
  refresh();
  return {};
}

// ——— Задачи на доске ———

const title = z.string().trim().min(1, "Введите название задачи").max(200, "Слишком длинное название");

// «+ Задача» в столбце: задача на сегодня, наверху столбца. Сроки, файлы и напоминание — в карточке задачи
export async function quickCreateTask(columnId: string, value: string): Promise<{ error?: string }> {
  const parsed = title.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const column = await db.boardColumn.findUnique({ where: { id: columnId }, select: { name: true } });
  if (!column) return { error: "Столбец удалён, обновите страницу" };
  const top = await db.event.findFirst({ where: { columnId }, orderBy: { position: "asc" }, select: { position: true } });
  const today = dayKey(new Date());
  await db.event.create({
    data: {
      kind: "TASK",
      title: parsed.data,
      // Задача, добавленная сразу в «Выполнено», уже выполнена
      done: isFinalColumn(column.name),
      start: fromKey(today),
      end: fromKey(addDays(today, 1)),
      allDay: true,
      columnId,
      position: (top?.position ?? 1) - 1,
    },
  });
  refresh();
  return {};
}

// order — id задач столбца сверху вниз уже с перенесённой: позиции пересчитываются по нему
export async function moveTask(id: string, columnId: string, order: string[]) {
  const task = await db.event.findUnique({ where: { id }, select: { id: true, title: true, kind: true, columnId: true, column: { select: { name: true } } } });
  if (task?.kind !== "TASK") return;
  const column = await db.boardColumn.findUnique({ where: { id: columnId }, select: { name: true, board: { select: { name: true, main: true, columns: { orderBy: { order: "asc" }, take: 1, select: { id: true } } } } } });
  if (!column) return;
  // Без столбца задача стоит в первом столбце основной доски: перенос туда — не перенос
  const from = task.columnId ?? (column.board.main ? column.board.columns[0]?.id : null);
  // В завершающий столбец — задача выполнена, обратно из него — снова открыта
  const toFinal = isFinalColumn(column.name);
  const fromFinal = !!task.column && isFinalColumn(task.column.name);
  const done = from === columnId || toFinal === fromFinal ? undefined : toFinal;
  await db.event.update({ where: { id }, data: { columnId, ...(done === undefined ? {} : { done }) } });
  // Задачи без столбца из первого столбца основной доски при этом получают его явно
  await db.$transaction(order.map((taskId, position) => db.event.updateMany({ where: { id: taskId, kind: "TASK" }, data: { columnId, position } })));
  if (from !== columnId) await logActivity(taskMoveActivity(task, column.name, column.board.name));
  refresh();
}
