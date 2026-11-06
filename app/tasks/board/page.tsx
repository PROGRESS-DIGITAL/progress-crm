import { db } from "@/lib/db";
import { TaskViewTabs } from "../view-tabs";
import { TaskBoard } from "./board";

export const dynamic = "force-dynamic";

// Доска задач команды: столбцы как у сделок, но свои — их называют, добавляют и удаляют прямо на доске
export default async function TaskBoardPage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const { card } = await searchParams;
  const [columns, employees] = await Promise.all([
    db.boardColumn.findMany({
      orderBy: { order: "asc" },
      include: { cards: { orderBy: { position: "asc" }, select: { id: true, title: true, notes: true, assigneeId: true } } },
    }),
    db.employee.findMany({ where: { blocked: false }, orderBy: { name: "asc" }, select: { id: true, name: true, avatar: true } }),
  ]);
  const total = columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    <div className="flex w-full flex-1 flex-col px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Задачи</h1>
        <TaskViewTabs current="board" />
        <span className="text-sm text-slate-500">Карточек на доске: {total}</span>
      </div>
      <TaskBoard
        columns={columns.map((c) => ({ id: c.id, name: c.name, cards: c.cards }))}
        employees={employees}
        openCardId={card ?? null}
      />
    </div>
  );
}
