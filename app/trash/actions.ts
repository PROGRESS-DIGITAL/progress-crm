"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { restoreFromTrash, TrashError } from "@/lib/trash";

// В корзине работают с записями только своих разделов
async function ownItem(id: string) {
  const user = await requireUser();
  const item = await db.trashItem.findUnique({ where: { id }, select: { id: true, section: true } });
  if (!item) return null;
  if (!user.isOwner && !user.sections.includes(item.section)) throw new Error("Нет доступа к этому разделу");
  return item;
}

export async function restoreItem(id: string) {
  if (!(await ownItem(id))) redirect("/trash");
  let href: string;
  try {
    href = (await restoreFromTrash(id)).href;
  } catch (e) {
    if (e instanceof TrashError) redirect(`/trash?error=${encodeURIComponent(e.message)}#${id}`);
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(href);
}

export async function deleteForever(id: string) {
  if (!(await ownItem(id))) return;
  await db.trashItem.delete({ where: { id } });
  revalidatePath("/trash");
}
