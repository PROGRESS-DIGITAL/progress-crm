import Link from "next/link";
import { db } from "@/lib/db";
import { formatRub } from "@/lib/format";
import { clientLtv, rankClients } from "@/lib/ltv";

export const dynamic = "force-dynamic";

const TOP = 10;

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const companies = await db.company.findMany({
    select: { id: true, name: true, deals: { select: { amount: true, stage: { select: { kind: true } } } } },
  });
  const rows = rankClients(companies.map(clientLtv));
  const paying = rows.filter((r) => r.ltv > 0);
  const totalLtv = paying.reduce((a, r) => a + r.ltv, 0);
  const totalOpen = rows.reduce((a, r) => a + r.open, 0);
  const top = paying.slice(0, TOP);
  const max = top[0]?.ltv ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        LTV клиента — сумма всех его сделок на этапе «Оплачен». «В работе» — открытые сделки, которые ещё могут
        принести оплату.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Оплачено всего" value={formatRub(totalLtv)} />
        <Tile
          label="Средний LTV"
          value={formatRub(paying.length ? Math.round(totalLtv / paying.length) : 0)}
          hint="по клиентам с оплатами"
        />
        <Tile label="Клиентов с оплатами" value={`${paying.length} из ${rows.length}`} />
        <Tile label="В работе" value={formatRub(totalOpen)} hint="открытые сделки всех клиентов" />
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Клиенты по LTV</h2>
        <p className="mt-1 text-sm text-slate-500">
          {paying.length > TOP ? `Топ-${TOP} из ${paying.length}` : "Все клиенты с оплатами"}
        </p>
        {top.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Пока нет оплаченных сделок. Перетащите сделку в колонку «Оплачен», и клиент появится здесь.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2" aria-label="Клиенты по LTV">
            {top.map((r) => (
              <li key={r.id} className="group relative grid grid-cols-[minmax(0,12rem)_1fr] items-center gap-3">
                <Link href={`/clients/${r.id}`} className="truncate text-sm text-slate-700 hover:text-blue-700">
                  {r.name}
                </Link>
                <div className="flex items-center gap-2">
                  <div
                    className="h-5 rounded-r-[4px] bg-blue-600 transition-colors group-hover:bg-blue-700"
                    style={{ width: `${Math.max((r.ltv / max) * 100, 1)}%`, maxWidth: "calc(100% - 7rem)" }}
                  />
                  <span className="shrink-0 text-sm text-slate-700 tabular-nums">{formatRub(r.ltv)}</span>
                </div>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute top-full left-48 z-10 mt-1 hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-md group-hover:block"
                >
                  <p className="font-medium text-slate-900">{r.name}</p>
                  <p>
                    Оплачено: {formatRub(r.ltv)} · сделок: {r.paidDeals}
                  </p>
                  <p>Средний чек: {formatRub(r.avgCheck)}</p>
                  <p>
                    В работе: {formatRub(r.open)} · сделок: {r.openDeals}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Все клиенты</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 text-right font-medium">LTV (оплачено)</th>
              <th className="px-4 py-3 text-right font-medium">Оплаченных сделок</th>
              <th className="px-4 py-3 text-right font-medium">Средний чек</th>
              <th className="px-4 py-3 text-right font-medium">В работе</th>
              <th className="px-4 py-3 text-right font-medium">Открытых сделок</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/clients/${r.id}`} className="text-slate-900 hover:text-blue-700">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{r.ltv ? formatRub(r.ltv) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.paidDeals || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                  {r.avgCheck ? formatRub(r.avgCheck) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.openDeals ? formatRub(r.open) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.openDeals || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
