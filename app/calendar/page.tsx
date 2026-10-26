import { db } from "@/lib/db";
import { getRemindChat } from "@/lib/reminders";
import { addDays, dayKey, fromKey, isDayKey, isView, viewDays } from "@/lib/calendar";
import { CalendarView } from "./calendar-view";
import type { CalEvent, Prefill } from "./types";

export const dynamic = "force-dynamic";

type Search = { view?: string; date?: string; new?: string; deal?: string; client?: string; open?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const today = dayKey(new Date());
  const view = isView(sp.view) ? sp.view : "week";
  const date = isDayKey(sp.date) ? sp.date : today;
  const days = viewDays(view, date);
  const from = fromKey(days[0]);
  const to = fromKey(addDays(days.at(-1)!, 1));

  const [events, companies, deals, tasks, remindChat] = await Promise.all([
    db.event.findMany({
      where: { start: { lt: to }, end: { gt: from } },
      orderBy: { start: "asc" },
      include: {
        company: { select: { name: true } },
        deal: { select: { title: true } },
        task: { select: { title: true } },
      },
    }),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.deal.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, companyId: true, stage: { select: { kind: true } } },
    }),
    db.event.findMany({
      where: { kind: "TASK" },
      orderBy: [{ done: "asc" }, { start: "desc" }],
      take: 200,
      select: { id: true, title: true, done: true },
    }),
    getRemindChat(),
  ]);

  const items: CalEvent[] = events.map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    notes: e.notes ?? "",
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    done: e.done,
    companyId: e.companyId,
    companyName: e.company?.name ?? null,
    dealId: e.dealId,
    dealTitle: e.deal?.title ?? null,
    taskId: e.taskId,
    taskTitle: e.task?.title ?? null,
    remindMinutes: e.remindMinutes,
  }));

  // Ссылки «Встреча» и «Задача» из сделки или клиента сразу открывают окно с привязкой
  let prefill: Prefill | null = null;
  if (sp.new === "MEETING" || sp.new === "TASK") {
    const deal = sp.deal ? deals.find((d) => d.id === sp.deal) : undefined;
    const companyId = deal?.companyId ?? sp.client;
    prefill = {
      kind: sp.new,
      dealId: deal?.id ?? "",
      clientName: companies.find((c) => c.id === companyId)?.name ?? "",
    };
  }
  const open = (sp.open && items.find((e) => e.id === sp.open)) || null;

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <CalendarView
        key={`${view}-${date}`}
        view={view}
        date={date}
        today={today}
        days={days}
        events={items}
        companies={companies}
        deals={deals.map((d) => ({ id: d.id, title: d.title, companyId: d.companyId, open: d.stage.kind === "OPEN" }))}
        tasks={tasks}
        prefill={prefill}
        openEvent={open}
        explicitView={isView(sp.view)}
        remindersOn={!!remindChat}
      />
    </div>
  );
}
