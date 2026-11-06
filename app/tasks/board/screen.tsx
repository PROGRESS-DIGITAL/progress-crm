import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadBoard } from "@/lib/boards";
import { TaskViewTabs } from "../view-tabs";
import { BoardTitle, DeleteBoardButton, TaskBoard } from "./board";

// Доска задач: основная (вкладка «Доска» у основных задач) или доска команды со своим названием
export async function BoardScreen({ id, rename = false }: { id: string | null; rename?: boolean }) {
  const [board, employees] = await Promise.all([
    loadBoard(id),
    db.employee.findMany({ where: { blocked: false }, orderBy: { name: "asc" }, select: { id: true, name: true, avatar: true } }),
  ]);
  if (!board) notFound();
  const total = board.columns.reduce((n, c) => n + c.tasks.length, 0);

  return (
    <div className="flex w-full flex-1 flex-col px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {board.main ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Задачи</h1>
            <TaskViewTabs current="board" />
          </>
        ) : (
          <BoardTitle key={board.name} id={board.id} name={board.name} rename={rename} />
        )}
        <span className="text-sm text-slate-500">Задач на доске: {total}</span>
        {!board.main && <DeleteBoardButton id={board.id} name={board.name} tasks={total} />}
      </div>
      <TaskBoard boardId={board.id} columns={board.columns} employees={employees} />
    </div>
  );
}
