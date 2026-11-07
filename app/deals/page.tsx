import Link from "next/link";
import { db } from "@/lib/db";
import { formatRub } from "@/lib/format";
import { Board } from "./board";
import { getAvatars } from "@/lib/profile";
import { currentUser } from "@/lib/auth/session";
import { accessForPath, canAccess } from "@/lib/auth/sections";
import { daysLabel, findStaleDeals, STALE_DAYS } from "@/lib/stale-deals";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const avatars = await getAvatars();
  // Ссылку на дашборд видят только те, кому открыт этот раздел
  const showDashboard = canAccess(accessForPath("/dashboard"), await currentUser());
  const clientNames = (await db.company.findMany({ select: { name: true }, orderBy: { name: "asc" } })).map((c) => c.name);
  const stages = await db.stage.findMany({
    orderBy: { order: "asc" },
    include: {
      deals: { orderBy: { position: "asc" }, include: { company: { select: { name: true } }, product: { select: { name: true } } } },
    },
  });

  const stale = await findStaleDeals();
  const open = stages.filter((s) => s.kind === "OPEN").flatMap((s) => s.deals);
  const won = stages.filter((s) => s.kind === "WON").flatMap((s) => s.deals);
  const sum = (ds: { amount: number }[]) => ds.reduce((acc, d) => acc + d.amount, 0);

  return (
    // Высота экрана без шапки (h-14 и рамка 1px): колонки воронки тянутся до низа
    <div className="flex w-full flex-1 flex-col px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Сделки</h1>
            {showDashboard && (
              <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-800 hover:underline">
                Дашборд →
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Открыто: {open.length} на {formatRub(sum(open))} · Оплачено: {won.length} на{" "}
            {formatRub(sum(won))}
            {stale.size > 0 && (
              <span className="text-amber-700" title={`Неделю и дольше нет ни задач, ни переписки. Самая давняя: ${daysLabel(Math.max(...stale.values()))}`}>
                {" "}
                · Без движения {STALE_DAYS}+ дней: {stale.size}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/deals/new"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
        >
          + Новая сделка
        </Link>
      </div>
      <Board
        clientNames={clientNames}
        avatars={avatars}
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
            startDate: d.startDate.toISOString(),
            expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
            position: d.position,
            staleDays: stale.get(d.id) ?? null,
          })),
        }))}
      />
    </div>
  );
}
