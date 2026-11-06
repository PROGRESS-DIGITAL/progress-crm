import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ACTIVITY_DAYS, visibleTo } from "@/lib/activity";
import { moscowDay } from "@/lib/activity-text";
import { ActivityIcon } from "@/components/activity-icon";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const dayTitle = (key: string, today: string, yesterday: string) =>
  key === today
    ? "Сегодня"
    : key === yesterday
      ? "Вчера"
      : new Date(`${key}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" });

const time = (d: Date) => d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

// Журнал событий целиком: всё, что происходило в открытых сотруднику разделах, по дням
export default async function ActivityPage() {
  const user = await requireUser();
  const rows = await db.activity.findMany({ where: visibleTo(user), orderBy: { createdAt: "desc" }, take: 500 });
  await db.employee.update({ where: { id: user.id }, data: { activitySeenAt: new Date() } });

  const now = new Date();
  const today = moscowDay(now);
  const yesterday = moscowDay(new Date(now.getTime() - 86_400_000));
  const days = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = moscowDay(r.createdAt);
    days.set(key, [...(days.get(key) ?? []), r]);
  }

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Журнал событий</h1>
          <p className="mt-1 text-sm text-slate-600">Что происходило в CRM за последние {ACTIVITY_DAYS} дней</p>
        </div>
        <Link href="/trash" className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm text-slate-700 shadow-card hover:text-slate-900">
          <Icon name="trash" size={16} />
          Корзина
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Событий пока нет. Здесь появятся новые лиды, сделки, встречи, задачи, счета, оплаты и удаления.
        </p>
      ) : (
        <div className="space-y-5">
          {[...days].map(([key, list]) => (
            <section key={key}>
              <h2 className="mb-2 text-sm font-medium text-slate-500 first-letter:uppercase">{dayTitle(key, today, yesterday)}</h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-card">
                {list.map((r) => {
                  const body = (
                    <>
                      <ActivityIcon kind={r.kind} />
                      <span className="min-w-0 flex-1 text-sm text-slate-800">{r.text}</span>
                      <span className="shrink-0 text-right text-xs text-slate-500">
                        <span className="block tabular-nums">{time(r.createdAt)}</span>
                        {r.actor && <span className="hidden sm:block">{r.actor}</span>}
                      </span>
                    </>
                  );
                  return (
                    <li key={r.id}>
                      {r.href ? (
                        <Link href={r.href} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
