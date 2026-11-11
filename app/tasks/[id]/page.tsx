import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Icon } from "@/components/icons";
import { dayKey } from "@/lib/calendar";
import { draftFromEvent, emptyDraft } from "@/app/calendar/drafts";
import { TaskForm } from "../task-form";
import { taskOptions } from "../options";
import { boardChoices } from "@/lib/boards";
import { requireUser } from "@/lib/auth/session";
import { CreateFrom, type CreateFromLink } from "@/components/create-from";

export const dynamic = "force-dynamic";

type Search = { deal?: string; client?: string; board?: string; task?: string };

// /tasks/new — новая задача (из сделки или клиента приходит с привязкой), /tasks/<id> — карточка задачи
export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [{ remindersOn, ...options }, boards, employees, user] = await Promise.all([
    taskOptions(),
    boardChoices(),
    db.employee.findMany({ where: { blocked: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    requireUser(),
  ]);
  const placement = { boards, employees };
  const me = { id: user.id, isOwner: user.isOwner };
  const mainFirst = boards.find((b) => b.main)?.columns[0]?.id ?? "";
  // Открыли с доски — туда и возвращаемся
  const from = sp.board ? boards.find((b) => b.id === sp.board) : undefined;
  const back = from ? (from.main ? "/tasks/board" : `/tasks/board/${from.id}`) : "/tasks";

  if (id === "new") {
    const deal = sp.deal ? options.deals.find((d) => d.id === sp.deal) : undefined;
    const companyId = deal?.companyId ?? sp.client;
    // Из карточки задачи: новая задача связывается с ней
    const parent = sp.task ? await db.event.findFirst({ where: { id: sp.task, kind: "TASK" }, select: { id: true } }) : null;
    const today = dayKey(new Date());
    const initial = emptyDraft(today, 9 * 60, {
      kind: "TASK",
      allDay: true,
      remindMinutes: "",
      dealId: deal?.id ?? "",
      taskId: parent?.id ?? "",
      clientName: options.companies.find((c) => c.id === companyId)?.name ?? "",
    });
    initial.columnId = mainFirst;
    initial.assigneeId = "";
    return (
      <Shell title="Новая задача" back={back}>
        <TaskForm id={null} initial={initial} options={options} files={[]} remindersOn={remindersOn} placement={placement} comments={[]} me={me} back={back} />
      </Shell>
    );
  }

  const task = await db.event.findUnique({
    where: { id },
    include: {
      company: { select: { name: true } },
      files: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, size: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { avatar: true } } } },
      column: { select: { boardId: true, board: { select: { main: true } } } },
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
  initial.columnId = task.columnId ?? mainFirst;
  initial.assigneeId = task.assigneeId ?? "";
  // Задачу доски команды открывают без ?board= из журнала событий: назад — на её доску
  const home = from ? back : task.column && !task.column.board.main ? `/tasks/board/${task.column.boardId}` : back;
  const comments = task.comments.map((c) => ({
    id: c.id,
    authorId: c.authorId,
    authorName: c.authorName,
    avatar: c.author?.avatar ?? null,
    text: c.text,
    createdAt: c.createdAt.toISOString(),
  }));
  return (
    <Shell title="Задача" back={home} create={{ companyId: task.companyId, dealId: task.dealId, taskId: task.id }} calendar={task.column && !task.column.board.main ? undefined : `/calendar?view=day&date=${dayKey(task.start)}`}>
      <TaskForm
        key={task.updatedAt.toISOString()}
        id={task.id}
        initial={initial}
        options={options}
        files={task.files}
        remindersOn={remindersOn}
        placement={placement}
        comments={comments}
        me={me}
        back={home}
      />
    </Shell>
  );
}

function Shell({
  title,
  back,
  calendar,
  create,
  children,
}: {
  title: string;
  back: string;
  calendar?: string;
  create?: CreateFromLink;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={back} aria-label={back === "/tasks" ? "Ко всем задачам" : "К доске"} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-card hover:text-slate-800">
            <Icon name="back" size={18} />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-4">
          {calendar && (
            <Link href={calendar} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <Icon name="calendar" size={16} />
              В календаре
            </Link>
          )}
          {create && <CreateFrom link={create} />}
        </div>
      </div>
      {children}
    </div>
  );
}
