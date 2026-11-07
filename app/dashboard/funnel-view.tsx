import Link from "next/link";
import { db } from "@/lib/db";
import { fromKey } from "@/lib/calendar";
import { daysLabel, formatRub } from "@/lib/format";
import { monthKey, shiftMonth } from "@/lib/monthly";
import { DEFAULT_PERIOD, PERIODS, dealOutcomes, leadFunnel, percent, stageLoad } from "@/lib/funnel";

const card = "rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card sm:p-5";

function Tile({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className={card}>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className={`mt-2 text-[26px] font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-slate-500">{note}</p>
    </div>
  );
}

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

// Вкладка «Воронка»: от заявки до оплаты, успешные и проигранные сделки, причины проигрыша, где стоят сделки
export async function FunnelView({ period: requested }: { period?: string }) {
  const period = PERIODS.find((p) => p.value === requested) ?? PERIODS.find((p) => p.value === DEFAULT_PERIOD)!;
  const now = new Date();
  const from = period.months ? fromKey(`${shiftMonth(monthKey(now), -(period.months - 1))}-01`) : null;

  const [leads, deals, stages, openDeals] = await Promise.all([
    db.lead.findMany({
      where: from ? { createdAt: { gte: from } } : {},
      select: { status: true, rejectReason: true, deal: { select: { stage: { select: { kind: true } } } } },
    }),
    db.deal.findMany({
      where: from ? { startDate: { gte: from } } : {},
      select: { amount: true, startDate: true, closedAt: true, lostReason: true, stage: { select: { kind: true } } },
    }),
    db.stage.findMany({ where: { kind: "OPEN" }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.deal.findMany({ where: { stage: { kind: "OPEN" } }, select: { stageId: true, amount: true, startDate: true } }),
  ]);

  const lf = leadFunnel(leads.map((l) => ({ status: l.status, rejectReason: l.rejectReason, dealKind: l.deal?.stage.kind ?? null })));
  const out = dealOutcomes(deals.map((d) => ({ ...d, kind: d.stage.kind })));
  const load = stageLoad(stages, openDeals, now);
  const maxLost = Math.max(1, ...out.lostReasons.map((r) => r.count));
  const maxStage = Math.max(1, ...load.rows.map((r) => r.count));

  const steps = [
    { label: "Заявки", value: lf.total, note: "все заявки за период" },
    { label: "Дошли до сделки", value: lf.toDeal, note: `${pct(percent(lf.toDeal, lf.total))} от заявок` },
    { label: "Оплачены", value: lf.paid, note: `${pct(percent(lf.paid, lf.total))} от заявок · ${pct(percent(lf.paid, lf.toDeal))} от сделок` },
  ];
  const closed = out.won + out.lost;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Заявки — по дате поступления, сделки — по дате начала. Успешные и проигранные считаются от закрытых сделок.
        </p>
        <nav className="flex rounded-xl bg-white p-1 text-sm shadow-card" aria-label="Период">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/dashboard?view=funnel${p.value === DEFAULT_PERIOD ? "" : `&period=${p.value}`}`}
              aria-current={period.value === p.value ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 whitespace-nowrap ${period.value === p.value ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label="Заявка → оплата" value={pct(percent(lf.paid, lf.total))} note={`${lf.paid} из ${lf.total} заявок оплачены`} />
        <Tile label="Заявка → сделка" value={pct(percent(lf.toDeal, lf.total))} note={`${lf.toDeal} из ${lf.total} заявок`} />
        <Tile
          label="Успешные"
          value={pct(out.winRate)}
          note={`${out.won} из ${closed} закрытых · ${formatRub(out.wonSum)}`}
          tone="text-emerald-700"
        />
        <Tile
          label="Проигранные"
          value={pct(out.lossRate)}
          note={`${out.lost} из ${closed} закрытых · ${formatRub(out.lostSum)}`}
          tone="text-rose-600"
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-semibold">От заявки до оплаты</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {steps.map((s) => (
              <li key={s.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-700">{s.label}</span>
                  <span className="font-semibold tabular-nums">{s.value}</span>
                </div>
                <div className="mt-1 h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-blue-500" style={{ width: `${lf.total && s.value ? Math.max(2, (s.value / lf.total) * 100) : 0}%` }} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{s.note}</p>
              </li>
            ))}
          </ol>
          {(lf.open > 0 || lf.rejected > 0) && (
            <p className="mt-4 text-xs text-slate-500">
              Ещё не разобраны: {lf.open} · отклонены: {lf.rejected}
              {lf.rejectReasons.length > 0 &&
                ` (${lf.rejectReasons
                  .slice(0, 3)
                  .map((r) => `${r.reason.toLowerCase()} — ${r.count}`)
                  .join(", ")})`}
            </p>
          )}
        </section>

        <section className={card}>
          <h2 className="font-semibold">Чем закончились сделки</h2>
          <p className="mt-1 text-sm text-slate-500">
            Начато за период: {out.total}
            {out.avgCycleDays !== null && ` · от начала до оплаты в среднем ${daysLabel(out.avgCycleDays)}`}
          </p>
          {out.total > 0 ? (
            <>
              <div className="mt-4 flex h-4 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Оплачено ${out.won}, проиграно ${out.lost}, в работе ${out.open}`}>
                {out.won > 0 && <div className="bg-emerald-500" style={{ flexGrow: out.won }} />}
                {out.lost > 0 && <div className="bg-rose-400" style={{ flexGrow: out.lost }} />}
                {out.open > 0 && <div className="bg-slate-200" style={{ flexGrow: out.open }} />}
              </div>
              <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>
                    Оплачено <b className="tabular-nums">{out.won}</b>
                    <span className="block text-xs text-slate-500">{formatRub(out.wonSum)}</span>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" />
                  <span>
                    Проиграно <b className="tabular-nums">{out.lost}</b>
                    <span className="block text-xs text-slate-500">{formatRub(out.lostSum)}</span>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />
                  <span>
                    В работе <b className="tabular-nums">{out.open}</b>
                    <span className="block text-xs text-slate-500">{formatRub(out.openSum)}</span>
                  </span>
                </li>
              </ul>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500">За этот период сделок не было.</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-semibold">Почему проигрываем</h2>
          <p className="mt-1 text-sm text-slate-500">Причина из карточки проигранной сделки</p>
          {out.lostReasons.length ? (
            <ul className="mt-4 flex flex-col gap-3">
              {out.lostReasons.map((r) => (
                <li key={r.reason}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{r.reason}</span>
                    <span className="shrink-0 tabular-nums">
                      <b>{r.count}</b>
                      <span className="text-slate-500"> · {pct(percent(r.count, out.lost))} · {formatRub(r.sum)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-rose-400" style={{ width: `${(r.count / maxLost) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Проигранных сделок за период нет.</p>
          )}
        </section>

        <section className={card}>
          <h2 className="font-semibold">Где стоят сделки сейчас</h2>
          <p className="mt-1 text-sm text-slate-500">Открытые сделки по этапам и сколько дней они уже в работе</p>
          <ul className="mt-4 flex flex-col gap-3">
            {load.rows.map((r) => (
              <li key={r.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-slate-700">{r.name}</span>
                    {r.id === load.slowest && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">дольше всего</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <b>{r.count}</b>
                    {r.count > 0 && <span className="text-slate-500"> · {formatRub(r.sum)}</span>}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(r.count / maxStage) * 100}%` }} />
                </div>
                {r.avgDays !== null && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    в среднем {daysLabel(r.avgDays)} в работе
                    {r.count > 1 && ` · самая давняя ${daysLabel(r.maxDays!)}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
