import Link from "next/link";
import { db } from "@/lib/db";
import { dayKey, minutesOfDay, timeLabel } from "@/lib/calendar";
import { Icon } from "@/components/icons";
import { KindMark } from "@/components/event-kind";

const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", weekday: "short", timeZone: "Europe/Moscow" });

// Задачи и встречи сделки или клиента: предстоящие и невыполненные, со ссылками в календарь
export async function LinkedEvents({ dealId, companyId }: { dealId?: string; companyId?: string }) {
  const now = new Date();
  const link = dealId ? { dealId } : { companyId };
  const events = await db.event.findMany({
    where: { ...link, OR: [{ end: { gte: now } }, { kind: "TASK", done: false }] },
    orderBy: { start: "asc" },
    take: 8,
  });
  const query = dealId ? `deal=${dealId}` : `client=${companyId}`;
  const button = "flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50";

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Задачи и встречи</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/tasks/new?${query}`} className={button}>
            <Icon name="plus" size={16} />
            Задача
          </Link>
          <Link href={`/calendar?new=MEETING&${query}`} className={button}>
            <Icon name="plus" size={16} />
            Встреча
          </Link>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Открытых задач и запланированных встреч нет.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {events.map((e) => {
            const overdue = e.kind === "TASK" && !e.done && e.end < now;
            return (
              <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                <KindMark kind={e.kind} done={e.done} />
                <Link
                  href={e.kind === "TASK" ? `/tasks/${e.id}` : `/calendar?view=day&date=${dayKey(e.start)}&open=${e.id}`}
                  className={`min-w-0 flex-1 truncate font-medium hover:text-blue-700 ${e.done ? "text-slate-400 line-through" : ""}`}
                >
                  {e.title}
                </Link>
                <span className={`shrink-0 tabular-nums ${overdue ? "text-rose-600" : "text-slate-500"}`}>
                  {dateLabel.format(e.start)}
                  {!e.allDay && `, ${timeLabel(minutesOfDay(e.start))}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
