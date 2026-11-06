import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BoardScreen } from "../screen";

export const dynamic = "force-dynamic";

// Доска команды. ?rename=1 — только что созданная: название сразу открыто для правки
export default async function TeamBoardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ rename?: string }> }) {
  const { id } = await params;
  const board = await db.board.findUnique({ where: { id }, select: { main: true } });
  if (board?.main) redirect("/tasks/board");
  return <BoardScreen id={id} rename={(await searchParams).rename === "1"} />;
}
