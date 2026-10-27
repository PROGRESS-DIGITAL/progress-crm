import Link from "next/link";
import { db } from "@/lib/db";
import { Icon, type IconName } from "@/components/icons";
import { formatRub } from "@/lib/format";
import { clientLtv, rankClients } from "@/lib/ltv";

const TOP = 10;

// Цвет полоски по месту в рейтинге: первые четыре места свои, остальные — серые
const RANK_BAR = [
  "bg-blue-600 group-hover:bg-blue-700",
  "bg-emerald-500 group-hover:bg-emerald-600",
  "bg-sky-400 group-hover:bg-sky-500",
  "bg-orange-400 group-hover:bg-orange-500",
];
const REST_BAR = "bg-slate-300 group-hover:bg-slate-400";

function Crown({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-label="Самый большой клиент"
      role="img"
      className={`h-4 w-4 shrink-0 text-amber-500 ${className}`}
    >
      <title>Самый большой клиент</title>
      <path fill="currentColor" d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19.2 18H4.8L3 7.5Zm2 12h14v1.5H5V19.5Z" />
    </svg>
  );
}

function Tile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: IconName;
  tone: string;
}) {
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
      <p className="mt-4 text-[26px] font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// Вкладка «По клиентам»: LTV, топ клиентов и общая таблица
export async function ClientsView() {
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
    <div>
      <p className="mb-6 text-sm text-slate-600">
        LTV клиента — сумма всех его сделок на этапе «Оплачен». «В работе» — открытые сделки, которые ещё могут
        принести оплату.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon="wallet" tone="bg-blue-600" label="Оплачено всего" value={formatRub(totalLtv)} />
        <Tile
          icon="trend"
          tone="bg-emerald-500"
          label="Средний LTV"
          value={formatRub(paying.length ? Math.round(totalLtv / paying.length) : 0)}
          hint="по клиентам с оплатами"
        />
        <Tile icon="users" tone="bg-orange-400" label="Клиентов с оплатами" value={`${paying.length} из ${rows.length}`} />
        <Tile icon="deals" tone="bg-sky-500" label="В работе" value={formatRub(totalOpen)} hint="открытые сделки всех клиентов" />
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white shadow-card p-5">
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
            {top.map((r, i) => (
              <li key={r.id} className="group relative grid grid-cols-[minmax(0,12rem)_1fr] items-center gap-3">
                <Link
                  href={`/clients/${r.id}`}
                  className={`flex items-center gap-1.5 text-sm hover:text-blue-700 ${i === 0 ? "font-semibold text-slate-900" : "text-slate-700"}`}
                >
                  {i === 0 && <Crown />}
                  <span className="truncate">{r.name}</span>
                </Link>
                <div className="flex items-center gap-2">
                  <div
                    className={`grow-x h-5 rounded-r-[4px] transition-colors ${RANK_BAR[i] ?? REST_BAR}`}
                    style={{
                      width: `${Math.max((r.ltv / max) * 100, 1)}%`,
                      maxWidth: "calc(100% - 7rem)",
                      animationDelay: `${i * 80}ms`,
                    }}
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

      <section className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-card">
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
            {rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/clients/${r.id}`}
                    className="inline-flex items-center gap-1.5 text-slate-900 hover:text-blue-700"
                  >
                    {i === 0 && r.ltv > 0 && <Crown />}
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
