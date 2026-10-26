import Link from "next/link";
import { db } from "@/lib/db";
import { Icon } from "@/components/icons";
import { toggleDone } from "@/app/calendar/actions";
import { BUCKET_LABELS, taskBucket, taskPeriod, type TaskBucket } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const FILTERS = [
  { show: "active", label: "В работе" },
  { show: "done", label: "Выполненные" },
  { show: "all", label: "Все" },
] as const;
type Show = (typeof FILTERS)[number]["show"];

const ORDER: TaskBucket[] = ["overdue", "today", "upcoming", "done"];

// Все задачи CRM: те же, что в календаре, сгруппированные по сроку
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const raw = (await searchParams).show;
  const show: Show = raw === "done" || raw === "all" ? raw : "active";
  const tasks = await db.event.findMany({
    where: { kind: "TASK", ...(show === "active" && { done: false }), ...(show === "done" && { done: true }) },
    orderBy: show === "done" ? { end: "desc" } : { end: "asc" },
    take: 500,
    include: {
      company: { select: { id: true, name: true } },
      deal: { select: { id: true, title: true } },
      _count: { select: { files: true } },
    },
  });
  const now = new Date();
  const groups = ORDER.map((b) => ({ bucket: b, items: tasks.filter((t) => taskBucket(t, now) === b) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Задачи</h1>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex rounded-xl bg-white p-1 text-sm shadow-card" aria-label="Какие задачи показать">
            {FILTERS.map((f) => (
              <Link
                key={f.show}
                href={f.show === "active" ? "/tasks" : `/tasks?show=${f.show}`}
                aria-current={show === f.show ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 sm:px-4 ${show === f.show ? "bg-blue-600 font-medium text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/tasks/new"
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
          >
            <Icon name="plus" size={16} />
            Новая задача
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {show === "done" ? "Выполненных задач пока нет." : "Задач нет. Создайте первую кнопкой «Новая задача»."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.bucket} className="rounded-2xl border border-slate-200/60 bg-white shadow-card">
              <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold sm:px-5">
                <span className={g.bucket === "overdue" ? "text-rose-600" : ""}>{BUCKET_LABELS[g.bucket]}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{g.items.length}</span>
              </h2>
              <ul className="divide-y divide-slate-100">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <form action={toggleDone.bind(null, t.id)} className="pt-0.5">
                      <button
                        type="submit"
                        aria-label={t.done ? "Вернуть в работу" : "Отметить выполненной"}
                        title={t.done ? "Вернуть в работу" : "Отметить выполненной"}
                        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                          t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-emerald-500"
                        }`}
                      >
                        {t.done && (
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden>
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        )}
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tasks/${t.id}`}
                        className={`block truncate font-medium hover:text-blue-700 ${t.done ? "text-slate-400 line-through" : "text-slate-900"}`}
                      >
                        {t.title}
                      </Link>
                      {t.notes && <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{t.notes}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className={`tabular-nums ${g.bucket === "overdue" ? "font-medium text-rose-600" : ""}`}>{taskPeriod(t)}</span>
                        {t.company && (
                          <Link href={`/clients/${t.company.id}`} className="hover:text-blue-700">
                            {t.company.name}
                          </Link>
                        )}
                        {t.deal && (
                          <Link href={`/deals/${t.deal.id}`} className="text-blue-600 hover:underline">
                            {t.deal.title}
                          </Link>
                        )}
                        {t._count.files > 0 && (
                          <span className="flex items-center gap-1">
                            <Icon name="clip" size={13} />
                            {t._count.files}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
