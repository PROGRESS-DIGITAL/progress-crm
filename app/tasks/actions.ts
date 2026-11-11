"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { MAX_FILE_SIZE, cleanFileName, fileSize } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";
import { mentionedLogins } from "@/lib/mentions";

// Файлы к задаче: приходят из формы, каждый до 15 МБ
export async function uploadTaskFiles(eventId: string, form: FormData): Promise<{ error?: string }> {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { kind: true } });
  if (event?.kind !== "TASK") return { error: "Задача не найдена, обновите страницу" };
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return {};
  const big = files.find((f) => f.size > MAX_FILE_SIZE);
  if (big) return { error: `Файл «${big.name}» больше ${fileSize(MAX_FILE_SIZE)}` };
  for (const f of files) {
    await db.eventFile.create({
      data: {
        eventId,
        name: cleanFileName(f.name),
        mime: f.type || "application/octet-stream",
        size: f.size,
        data: new Uint8Array(await f.arrayBuffer()),
      },
    });
  }
  revalidatePath(`/tasks/${eventId}`);
  revalidatePath("/tasks");
  return {};
}

export async function deleteTaskFile(id: string) {
  const file = await db.eventFile.findUnique({ where: { id }, select: { eventId: true } });
  if (!file) return;
  await db.eventFile.delete({ where: { id } });
  revalidatePath(`/tasks/${file.eventId}`);
  revalidatePath("/tasks");
}

const comment = z.string().trim().min(1, "Напишите комментарий").max(5000, "Слишком длинный комментарий");

// Комментарий команды к задаче: автор — тот, кто вошёл в CRM
export async function addTaskComment(eventId: string, text: string): Promise<{ error?: string }> {
  const parsed = comment.safeParse(text);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await requireUser();
  const event = await db.event.findUnique({ where: { id: eventId }, select: { kind: true, title: true } });
  if (event?.kind !== "TASK") return { error: "Задача не найдена, обновите страницу" };
  await db.eventComment.create({ data: { eventId, text: parsed.data, authorId: user.id, authorName: user.name } });
  // Упомянули коллег через @логин — строка в журнале событий со ссылкой на задачу
  if (parsed.data.includes("@")) {
    const staff = await db.employee.findMany({ where: { blocked: false, login: { not: null } }, select: { name: true, login: true } });
    const logins = mentionedLogins(parsed.data, staff.map((e) => e.login!));
    const names = staff.filter((e) => logins.includes(e.login!.toLowerCase())).map((e) => e.name);
    if (names.length > 0) {
      await logActivity({ section: "tasks", kind: "create", text: `Упоминание: ${names.join(", ")} в задаче «${event.title}»`, href: `/tasks/${eventId}` }, user.name);
    }
  }
  revalidatePath(`/tasks/${eventId}`);
  revalidatePath("/tasks", "layout");
  return {};
}

// Удалить комментарий может его автор или директор
export async function deleteTaskComment(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const found = await db.eventComment.findUnique({ where: { id }, select: { eventId: true, authorId: true } });
  if (!found) return {};
  if (!user.isOwner && found.authorId !== user.id) return { error: "Удалить можно только свой комментарий" };
  await db.eventComment.delete({ where: { id } });
  revalidatePath(`/tasks/${found.eventId}`);
  revalidatePath("/tasks", "layout");
  return {};
}
