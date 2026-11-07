import { db } from "@/lib/db";
import { dayKey, fromKey, minutesOfDay } from "@/lib/calendar";
import { getSetting, setSetting } from "@/lib/settings";
import { daysLabel, formatRub } from "@/lib/format";
export { daysLabel };

// «Забытая» сделка: открыта, по ней нет запланированной задачи или встречи и неделю ничего не происходило:
// сделку не меняли, задач не было, клиент не писал и ему не писали
export const STALE_DAYS = 7;
const DAY = 86_400_000;

export type Touches = {
  // Есть невыполненная задача или встреча на сегодня или позже: сделкой занимаются
  planned: boolean;
  dates: (Date | null | undefined)[];
};

// Сколько дней по сделке ничего не происходило; null — сделка не забыта
export function staleDays(t: Touches, now: Date) {
  if (t.planned) return null;
  const last = Math.max(...t.dates.filter((d): d is Date => !!d).map((d) => d.getTime()));
  if (!Number.isFinite(last)) return null;
  const days = Math.floor((now.getTime() - last) / DAY);
  return days >= STALE_DAYS ? days : null;
}

// Открытые сделки без движения: id сделки → сколько дней
export async function findStaleDeals(now = new Date()) {
  const today = fromKey(dayKey(now));
  const deals = await db.deal.findMany({
    where: { stage: { kind: "OPEN" } },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      companyId: true,
      events: { select: { updatedAt: true, done: true, start: true } },
      documents: { select: { createdAt: true } },
    },
  });
  if (!deals.length) return new Map<string, number>();
  const companyIds = [...new Set(deals.map((d) => d.companyId))];
  const [mails, chats] = await Promise.all([
    db.mailMessage.groupBy({ by: ["companyId"], where: { companyId: { in: companyIds } }, _max: { date: true } }),
    db.conversation.groupBy({ by: ["companyId"], where: { companyId: { in: companyIds } }, _max: { lastMessageAt: true } }),
  ]);
  const lastMail = new Map(mails.map((m) => [m.companyId, m._max.date]));
  const lastChat = new Map(chats.map((c) => [c.companyId, c._max.lastMessageAt]));

  const result = new Map<string, number>();
  for (const d of deals) {
    const days = staleDays(
      {
        planned: d.events.some((e) => !e.done && e.start >= today),
        dates: [
          d.createdAt,
          d.updatedAt,
          ...d.events.map((e) => e.updatedAt),
          ...d.documents.map((doc) => doc.createdAt),
          lastMail.get(d.companyId),
          lastChat.get(d.companyId),
        ],
      },
      now,
    );
    if (days !== null) result.set(d.id, days);
  }
  return result;
}

const LIST_LIMIT = 10;

export function staleDigestText(deals: { title: string; company: string; amount: number; days: number }[]) {
  const shown = deals.slice(0, LIST_LIMIT);
  return [
    `💤 Сделки без движения: ${deals.length}`,
    "Неделю и дольше по ним нет ни задач, ни переписки:",
    ...shown.map((d) => `• ${d.title} (${d.company}), ${formatRub(d.amount)}, ${daysLabel(d.days)}`),
    deals.length > shown.length ? `…и ещё ${deals.length - shown.length}` : null,
    "",
    "Поставьте задачу или закройте сделку. На доске «Сделки» они подсвечены.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

const DIGEST_SETTING = "staleDeals.sentDay";
// Сводка один раз в день, в 10:00 по Москве
const DIGEST_AT = 10 * 60;

export async function sendStaleDigest(now = new Date()) {
  if (minutesOfDay(now) < DIGEST_AT) return false;
  const today = dayKey(now);
  if ((await getSetting(DIGEST_SETTING)) === today) return false;
  const stale = await findStaleDeals(now);
  await setSetting(DIGEST_SETTING, today);
  if (!stale.size) return false;
  const deals = await db.deal.findMany({
    where: { id: { in: [...stale.keys()] } },
    select: { id: true, title: true, amount: true, company: { select: { name: true } } },
  });
  const list = deals
    .map((d) => ({ title: d.title, company: d.company.name, amount: d.amount, days: stale.get(d.id)! }))
    .sort((a, b) => b.days - a.days);
  const { notifyOwner } = await import("@/lib/auth/notify");
  return notifyOwner(staleDigestText(list));
}
