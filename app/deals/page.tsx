import Link from "next/link";
import { db } from "@/lib/db";
import { formatRub } from "@/lib/format";
import { Board } from "./board";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const stages = await db.stage.findMany({
    orderBy: { order: "asc" },
    include: {
      deals: { orderBy: { position: "asc" }, include: { company: { select: { name: true } }, product: { select: { name: true } } } },
    },
  });

  const open = stages.filter((s) => s.kind === "OPEN").flatMap((s) => s.deals);
  const won = stages.filter((s) => s.kind === "WON").flatMap((s) => s.deals);
  const sum = (ds: { amount: number }[]) => ds.reduce((acc, d) => acc + d.amount, 0);

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Сделки</h1>
          <p className="mt-1 text-sm text-slate-600">
            Открыто: {open.length} на {formatRub(sum(open))} · Оплачено: {won.length} на{" "}
            {formatRub(sum(won))}
          </p>
        </div>
        <Link
          href="/deals/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Новая сделка
        </Link>
      </div>
      <Board
        stages={stages.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          deals: s.deals.map((d) => ({
            id: d.id,
            title: d.title,
            clientName: d.company.name,
            amount: d.amount,
            service: d.service,
            productName: d.product?.name ?? null,
            owner: d.owner,
            position: d.position,
          })),
        }))}
      />
    </div>
  );
}
