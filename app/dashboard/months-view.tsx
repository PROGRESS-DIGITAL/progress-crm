import { db } from "@/lib/db";
import { Icon, type IconName } from "@/components/icons";
import { formatRub } from "@/lib/format";
import { change, emptyMonth, monthKey, monthLabel, monthlyStats, shiftMonth, type MonthStats } from "@/lib/monthly";

const MONTHS_SHOWN = 12;

function Delta({
  current,
  previous,
  label,
  fmt,
}: {
  current: number;
  previous: number;
  label: string;
  fmt: (n: number) => string;
}) {
  const pct = change(current, previous);
  return (
    <p className="flex items-center gap-1.5 text-xs text-slate-500">
      {pct !== null && (
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${pct >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}
        >
          {pct >= 0 ? "↗" : "↘"} {Math.abs(pct)}%
        </span>
      )}
      <span>
        {label}: <span className="tabular-nums">{fmt(previous)}</span>
      </span>
    </p>
  );
}

export function CompareTile({
  label,
  current,
  prev,
  yearAgo,
  money,
  icon,
  tone,
}: {
  icon: IconName;
  tone: string;
  label: string;
  current: number;
  prev: number;
  yearAgo: number;
  money?: boolean;
}) {
  const fmt = (n: number) => (money ? formatRub(n) : n.toLocaleString("ru-RU"));
  return (
    <div
      className="tile-glow rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card"
      style={{ "--glow": `var(--color-${tone.slice(3)})` } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <span className={`tile-icon flex h-10 w-10 items-center justify-center rounded-full text-white ${tone}`}>
          <Icon name={icon} size={18} />
        </span>
        <p className="text-sm font-medium text-slate-700">{label}</p>
      </div>
      <p className="mt-4 text-[26px] font-semibold tracking-tight tabular-nums">{fmt(current)}</p>
      <div className="mt-3 flex flex-col gap-1.5">
        <Delta current={current} previous={prev} label="прошлый месяц" fmt={fmt} />
        <Delta current={current} previous={yearAgo} label="год назад" fmt={fmt} />
      </div>
    </div>
  );
}

// Вкладка «По месяцам»: выручка по дате оплаты, сравнение с прошлым месяцем и тем же месяцем год назад
export async function MonthsView() {
  const deals = await db.deal.findMany({
    select: { amount: true, startDate: true, closedAt: true, stage: { select: { kind: true } } },
  });
  const stats = monthlyStats(deals.map((d) => ({ ...d, kind: d.stage.kind })));
  const at = (key: string): MonthStats => stats.get(key) ?? emptyMonth(key);

  const now = monthKey(new Date());
  const cur = at(now);
  const prev = at(shiftMonth(now, -1));
  const yearAgo = at(shiftMonth(now, -12));

  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => shiftMonth(now, i - MONTHS_SHOWN + 1));
  const rows = months.map((key) => ({ ...at(key), lastYear: at(shiftMonth(key, -12)).revenue }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.revenue, r.lastYear]));
  const totalYear = rows.reduce((a, r) => a + r.revenue, 0);
  const totalLastYear = rows.reduce((a, r) => a + r.lastYear, 0);

  return (
    <div>
      <p className="mb-6 text-sm text-slate-600">
        Выручка — оплаченные сделки по дате оплаты. Новые сделки — по дате начала. {monthLabel(now)} сравнивается с
        прошлым месяцем и с тем же месяцем год назад.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CompareTile label={`Выручка · ${monthLabel(now)}`} current={cur.revenue} prev={prev.revenue} yearAgo={yearAgo.revenue} money icon="wallet" tone="bg-blue-600" />
        <CompareTile label="Оплачено сделок" current={cur.paid} prev={prev.paid} yearAgo={yearAgo.paid} icon="check" tone="bg-emerald-500" />
        <CompareTile label="Новых сделок" current={cur.started} prev={prev.started} yearAgo={yearAgo.started} icon="plus" tone="bg-orange-400" />
        <CompareTile label="Средний чек" current={cur.avgCheck} prev={prev.avgCheck} yearAgo={yearAgo.avgCheck} money icon="receipt" tone="bg-sky-500" />
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white shadow-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-semibold">Выручка по месяцам</h2>
            <p className="mt-1 text-sm text-slate-500">
              За 12 месяцев: {formatRub(totalYear)}
              {totalLastYear > 0 && ` · год назад: ${formatRub(totalLastYear)}`}
            </p>
          </div>
          <ul className="flex gap-4 text-xs text-slate-600" aria-label="Легенда">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-300" /> Этот период
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> Год назад
            </li>
          </ul>
        </div>
        <div className="mt-6 flex h-56 items-end gap-2" role="img" aria-label="Выручка по месяцам">
          {rows.map((r, i) => (
            <div key={r.key} className="group relative flex h-full flex-1 items-end justify-center gap-0.5">
              <div
                className="grow-y w-2/5 rounded-md bg-slate-200"
                style={{ height: `${(r.lastYear / max) * 100}%`, minHeight: r.lastYear ? 2 : 0, animationDelay: `${i * 30}ms` }}
              />
              <div
                className={`grow-y w-2/5 rounded-md ${r.key === now ? "bg-blue-600" : "bg-blue-300"} group-hover:bg-blue-500`}
                style={{ height: `${(r.revenue / max) * 100}%`, minHeight: r.revenue ? 2 : 0, animationDelay: `${i * 30}ms` }}
              />
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-2 hidden w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:block"
              >
                <p className="font-medium text-slate-900">{monthLabel(r.key)}</p>
                <p>Выручка: {formatRub(r.revenue)}</p>
                <p>Год назад: {formatRub(r.lastYear)}</p>
                <p>
                  Оплачено: {r.paid} · новых: {r.started}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2">
          {rows.map((r) => (
            <span
              key={r.key}
              className={`flex-1 text-center text-[11px] ${r.key === now ? "font-semibold text-slate-900" : "text-slate-500"}`}
            >
              {monthLabel(r.key, true)}
            </span>
          ))}
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-card">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">По месяцам</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Месяц</th>
              <th className="px-4 py-3 text-right font-medium">Выручка</th>
              <th className="px-4 py-3 text-right font-medium">Год назад</th>
              <th className="px-4 py-3 text-right font-medium">Оплачено сделок</th>
              <th className="px-4 py-3 text-right font-medium">Средний чек</th>
              <th className="px-4 py-3 text-right font-medium">Новых сделок</th>
              <th className="px-4 py-3 text-right font-medium">Проиграно</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...rows].reverse().map((r) => {
              const pct = change(r.revenue, r.lastYear);
              return (
                <tr key={r.key} className={r.key === now ? "bg-blue-50/40" : "hover:bg-slate-50"}>
                  <td className="px-4 py-3">{monthLabel(r.key)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{r.revenue ? formatRub(r.revenue) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {r.lastYear ? formatRub(r.lastYear) : "—"}
                    {pct !== null && (
                      <span className={`ml-1 text-xs ${pct >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {pct >= 0 ? "+" : ""}
                        {pct}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.paid || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.avgCheck ? formatRub(r.avgCheck) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.started || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.lost || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
