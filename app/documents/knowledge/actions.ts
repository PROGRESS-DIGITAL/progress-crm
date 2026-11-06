"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { actorName } from "@/lib/auth/session";
import { sanitizeHtml } from "@/lib/contracts/sanitize";
import { isKnowledgeKind } from "@/lib/knowledge";
import { MAX_FILE_SIZE, cleanFileName, fileSize } from "@/lib/tasks";
import { trashKnowledge } from "@/lib/trash";

const schema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(200, "Слишком длинное название"),
  kind: z.string().refine(isKnowledgeKind, "Выберите раздел"),
  content: z.string().max(2_000_000, "Слишком длинный текст"),
});

function refresh(id?: string) {
  revalidatePath("/documents");
  if (id) revalidatePath(`/documents/knowledge/${id}`);
}

// Пустой редактор отдаёт <br> или пустой абзац: такой текст не храним
const isEmptyHtml = (html: string) => !html.replace(/<[^>]*>|&nbsp;|\s/g, "");

// Сохранение материала вместе с новыми файлами: они приходят в той же форме, каждый до 15 МБ
export async function saveKnowledge(id: string | null, form: FormData): Promise<{ error?: string; id?: string }> {
  const parsed = schema.safeParse({ title: form.get("title"), kind: form.get("kind"), content: form.get("content") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const big = files.find((f) => f.size > MAX_FILE_SIZE);
  if (big) return { error: `Файл «${big.name}» больше ${fileSize(MAX_FILE_SIZE)}` };

  const { title, kind, content } = parsed.data;
  const data = { title, kind: kind as never, content: isEmptyHtml(content) ? null : sanitizeHtml(content) };
  if (id && !(await db.knowledgeItem.findUnique({ where: { id }, select: { id: true } }))) return { error: "Материал уже удалён" };
  const saved = id
    ? await db.knowledgeItem.update({ where: { id }, data, select: { id: true } })
    : await db.knowledgeItem.create({ data: { ...data, author: await actorName() }, select: { id: true } });
  for (const f of files)
    await db.knowledgeFile.create({
      data: {
        itemId: saved.id,
        name: cleanFileName(f.name),
        mime: f.type || "application/octet-stream",
        size: f.size,
        data: new Uint8Array(await f.arrayBuffer()),
      },
    });
  refresh(saved.id);
  return { id: saved.id };
}

export async function deleteKnowledgeFile(id: string) {
  const file = await db.knowledgeFile.findUnique({ where: { id }, select: { itemId: true } });
  if (!file) return;
  await db.knowledgeFile.delete({ where: { id } });
  refresh(file.itemId);
}

// Удалённый материал вместе с файлами уходит в корзину
export async function deleteKnowledge(id: string) {
  await trashKnowledge(id);
  refresh(id);
}
