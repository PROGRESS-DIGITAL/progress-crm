import { db } from "@/lib/db";

// Выполненные задачи остаются на доске неделю, потом их видно только в списке и в самой задаче
const DONE_VISIBLE_DAYS = 7;

export type BoardTask = {
  id: string;
  title: string;
  done: boolean;
  start: string;
  end: string;
  allDay: boolean;
  assigneeId: string | null;
  client: string | null;
  deal: string | null;
  remind: boolean;
  files: number;
  comments: number;
};
export type BoardColumnData = { id: string; name: string; tasks: BoardTask[] };
export type BoardData = { id: string; name: string; main: boolean; columns: BoardColumnData[] };

// Доска со столбцами и задачами. Без id — основная. Задачи без столбца стоят в её первом столбце
export async function loadBoard(id: string | null): Promise<BoardData | null> {
  const board = await db.board.findFirst({
    where: id ? { id } : { main: true },
    include: { columns: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
  });
  if (!board) return null;
  const since = new Date(Date.now() - DONE_VISIBLE_DAYS * 86_400_000);
  const columnIds = board.columns.map((c) => c.id);
  const tasks = await db.event.findMany({
    where: {
      kind: "TASK",
      OR: [{ columnId: { in: columnIds } }, ...(board.main ? [{ columnId: null }] : [])],
      AND: [{ OR: [{ done: false }, { updatedAt: { gt: since } }] }],
    },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      done: true,
      start: true,
      end: true,
      allDay: true,
      columnId: true,
      assigneeId: true,
      remindMinutes: true,
      company: { select: { name: true } },
      deal: { select: { title: true } },
      _count: { select: { files: true, comments: true } },
    },
  });
  const first = board.columns[0]?.id;
  return {
    id: board.id,
    name: board.name,
    main: board.main,
    columns: board.columns.map((c) => ({
      id: c.id,
      name: c.name,
      tasks: tasks
        .filter((t) => (t.columnId ?? (board.main ? first : null)) === c.id)
        .map((t) => ({
          id: t.id,
          title: t.title,
          done: t.done,
          start: t.start.toISOString(),
          end: t.end.toISOString(),
          allDay: t.allDay,
          assigneeId: t.assigneeId,
          client: t.company?.name ?? null,
          deal: t.deal?.title ?? null,
          remind: t.remindMinutes !== null,
          files: t._count.files,
          comments: t._count.comments,
        })),
    })),
  };
}

// Доски команды для меню слева; основная там — это «Основные»
export function teamBoards() {
  return db.board.findMany({ where: { main: false }, orderBy: { order: "asc" }, select: { id: true, name: true } });
}

// Все столбцы всех досок: для выбора этапа в карточке задачи
export async function boardChoices() {
  const boards = await db.board.findMany({
    orderBy: [{ main: "desc" }, { order: "asc" }],
    select: { id: true, name: true, main: true, columns: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
  });
  return boards;
}

export type BoardChoice = Awaited<ReturnType<typeof boardChoices>>[number];
