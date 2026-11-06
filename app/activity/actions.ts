"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { visibleTo } from "@/lib/activity";
import { ago } from "@/lib/activity-text";

export type ActivityItem = { id: string; kind: string; text: string; href: string | null; actor: string | null; when: string; fresh: boolean };

// Открыли колокольчик: последние события и отметка, что журнал просмотрен
export async function openActivity(): Promise<ActivityItem[]> {
  const user = await requireUser();
  const [me, rows] = await Promise.all([
    db.employee.findUnique({ where: { id: user.id }, select: { activitySeenAt: true } }),
    db.activity.findMany({ where: visibleTo(user), orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const seen = me?.activitySeenAt?.getTime() ?? 0;
  await db.employee.update({ where: { id: user.id }, data: { activitySeenAt: new Date() } });
  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    text: r.text,
    href: r.href,
    actor: r.actor,
    when: ago(r.createdAt, now),
    fresh: r.createdAt.getTime() > seen && r.actor !== user.name,
  }));
}
