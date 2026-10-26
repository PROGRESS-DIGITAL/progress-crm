import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Icon } from "@/components/icons";
import { dayKey } from "@/lib/calendar";
import { draftFromEvent, emptyDraft } from "@/app/calendar/drafts";
import { TaskForm } from "../task-form";
import { taskOptions } from "../options";

export const dynamic = "force-dynamic";

type Search = { deal?: string; client?: string };

// /tasks/new — новая задача (из сделки или клиента приходит с привязкой), /tasks/<id> — карточка задачи
export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { remindersOn, ...options } = await taskOptions();

  if (id === "new") {
    const deal = sp.deal ? options.deals.find((d) => d.id === sp.deal) : undefined;
    const companyId = deal?.companyId ?? sp.client;
    const today = dayKey(new Date());
    const initial = emptyDraft(today, 9 * 60, {
      kind: "TASK",
      allDay: true,
      remindMinutes: "",
      dealId: deal?.id ?? "",
      clientName: options.companies.find((c) => c.id === companyId)?.name ?? "",
    });
    return (
      <Shell title="Новая задача">
        <TaskForm id={null} initial={initial} options={options} files={[]} remindersOn={remindersOn} />
      </Shell>
    );
  }

  const task = await db.event.findUnique({
    where: { id },
    include: {
      company: { select: { name: true } },
      files: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, size: true } },
    },
  });
  if (!task || task.kind !== "TASK") notFound();
  const initial = draftFromEvent({
    id: task.id,
    kind: task.kind,
    title: task.title,
    notes: task.notes ?? "",
    start: task.start.toISOString(),
    end: task.end.toISOString(),
    allDay: task.allDay,
    done: task.done,
    companyId: task.companyId,
    companyName: task.company?.name ?? null,
    dealId: task.dealId,
    dealTitle: null,
    taskId: task.taskId,
    taskTitle: null,
    remindMinutes: task.remindMinutes,
  });
  return (
    <Shell title="Задача" calendar={`/calendar?view=day&date=${dayKey(task.start)}`}>
      <TaskForm key={task.updatedAt.toISOString()} id={task.id} initial={initial} options={options} files={task.files} remindersOn={remindersOn} />
    </Shell>
  );
}

function Shell({ title, calendar, children }: { title: string; calendar?: string; children: React.ReactNode }) {
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/tasks" aria-label="Ко всем задачам" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-card hover:text-slate-800">
            <Icon name="back" size={18} />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {calendar && (
          <Link href={calendar} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
            <Icon name="calendar" size={16} />
            В календаре
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
