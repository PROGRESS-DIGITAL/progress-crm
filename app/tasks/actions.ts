"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { MAX_FILE_SIZE, cleanFileName, fileSize } from "@/lib/tasks";

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
