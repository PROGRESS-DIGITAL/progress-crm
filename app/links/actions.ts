"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/sections";
import { addLink, type LinkRow, type LinkTarget } from "@/lib/links";

// Связи заводят из сделок, задач и встреч: действие открыто всем, а право проверяем по обеим сторонам
async function allowed(targets: LinkTarget[]) {
  const user = await requireUser();
  return targets.every((t) =>
    canAccess({ kind: "section", keys: t.type === "deal" ? ["deals"] : ["calendar", "tasks"] }, user),
  );
}

function revalidate(targets: LinkTarget[]) {
  for (const t of targets) revalidatePath(t.type === "deal" ? `/deals/${t.id}` : `/tasks/${t.id}`);
  if (targets.some((t) => t.type === "event")) revalidatePath("/calendar");
}

export async function linkEntities(from: LinkTarget, to: LinkTarget): Promise<{ error?: string; link?: LinkRow }> {
  if (!(await allowed([from, to]))) return { error: "Нет доступа к этому разделу" };
  const link = await addLink(from, to);
  if (!link) return { error: "Запись не найдена, обновите страницу" };
  revalidate([from, to]);
  return { link };
}

export async function unlinkEntities(id: string): Promise<{ error?: string }> {
  const row = await db.entityLink.findUnique({ where: { id } });
  if (!row) return {};
  const targets: LinkTarget[] = [
    row.fromDealId ? { type: "deal", id: row.fromDealId } : { type: "event", id: row.fromEventId! },
    row.toDealId ? { type: "deal", id: row.toDealId } : { type: "event", id: row.toEventId! },
  ];
  if (!(await allowed(targets))) return { error: "Нет доступа к этому разделу" };
  await db.entityLink.delete({ where: { id } });
  revalidate(targets);
  return {};
}
