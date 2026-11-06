import { db } from "@/lib/db";
import { moveActivity, type ActivityEntry } from "@/lib/activity-text";

export const ACTIVITY_DAYS = 90;
export const TRASH_DAYS = 30;

// Кто сейчас работает в CRM. Вне запроса (бот, синхронизация банка) входа нет — тогда пусто, это сама CRM
async function currentActor() {
  try {
    const { currentUser } = await import("@/lib/auth/session");
    return (await currentUser())?.name ?? null;
  } catch {
    return null;
  }
}

// Старые строки журнала и корзины чистятся не чаще раза в час
let cleanedAt = 0;

// Запись в журнал не должна ломать само действие: ошибки только в лог сервера
export async function logActivity(entry: ActivityEntry, actor?: string | null) {
  try {
    await db.activity.create({ data: { ...entry, actor: actor === undefined ? await currentActor() : actor } });
    const now = Date.now();
    if (now - cleanedAt < 3_600_000) return;
    cleanedAt = now;
    await db.activity.deleteMany({ where: { createdAt: { lt: new Date(now - ACTIVITY_DAYS * 86_400_000) } } });
    await db.trashItem.deleteMany({ where: { deletedAt: { lt: new Date(now - TRASH_DAYS * 86_400_000) } } });
  } catch (e) {
    console.error("activity log failed", e);
  }
}

// Строки журнала и корзины, которые видны сотруднику: директору все, остальным — по разделам роли
export function visibleTo(user: { isOwner: boolean; sections: string[] }) {
  return user.isOwner ? {} : { section: { in: user.sections } };
}

// Сделку перенесли на другой этап: на доске, в карточке, AI агентом или после оплаты счёта
export async function logDealMoved(dealId: string, fromStageId: string | null, toStageId: string, actor?: string | null) {
  if (fromStageId === toStageId) return;
  try {
    const deal = await db.deal.findUnique({ where: { id: dealId }, select: { id: true, title: true, stage: { select: { name: true } } } });
    if (deal) await logActivity(moveActivity(deal, deal.stage.name), actor);
  } catch (e) {
    console.error("activity log failed", e);
  }
}

// Сколько событий сотрудник ещё не видел. Свои действия не считаются: о них он и так знает
export async function unseenActivity(user: { id: string; name: string; isOwner: boolean; sections: string[] }) {
  const me = await db.employee.findUnique({ where: { id: user.id }, select: { activitySeenAt: true } });
  return db.activity.count({
    where: {
      ...visibleTo(user),
      createdAt: { gt: me?.activitySeenAt ?? new Date(0) },
      OR: [{ actor: null }, { actor: { not: user.name } }],
    },
  });
}
