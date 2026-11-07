import Link from "next/link";
import { db } from "@/lib/db";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { getSetting } from "@/lib/settings";
import { formatRub } from "@/lib/format";
import { monthKey, monthLabel, shiftMonth } from "@/lib/monthly";
import { NO_OWNER, PLAN_SETTING, isMonthKey, managerReport, parsePlans, type ManagerRow } from "@/lib/managers";
import { AddPlanForm, PlanForm } from "./plan-form";

const card = "rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card sm:p-5";
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

function Tile({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className={card}>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className={`mt-2 text-[26px] font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-slate-500">{note}</p>
    </div>
  );
}

// Полоска выполнения плана: оплачено и сверху светлее — что ждём закрыть в этом месяце
function PlanBar({ row, showExpected }: { row: ManagerRow; showExpected: boolean }) {
  if (row.plan <= 0) return null;
  const done = Math.min(100, (row.revenue / row.plan) * 100);
  const expected = showExpected ? Math.min(100 - done, (row.expectedSum / row.plan) * 100) : 0;
  const met = row.revenue >= row.plan;
  return (
    <div
      className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100"
      role="img"
      aria-label={`Выполнено ${pct(row.progress)} плана`}
    >
      {done > 0 && <div className={met ? "bg-emerald-500" : "bg-blue-500"} style={{ width: `${Math.max(2, done)}%` }} />}
      {expected > 0 && <div className="bg-blue-200" style={{ width: `${expected}%` }} />}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums">
        {value}
        {note && <span className="font-normal text-slate-500"> · {note}</span>}
      </dd>
    </div>
  );
}

function ManagerCard({
  row,
  month,
  live,
  avatar,
  position,
}: {
  row: ManagerRow;
  month: string;
  live: boolean;
  avatar: string | null;
  position: string | null;
}) {
  const noOwner = row.owner === NO_OWNER;
  const left = row.plan - row.revenue;
  return (
    <section className={card}>
      <div className="flex items-center gap-3">
        {noOwner ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Icon name="users" size={16} />
          </span>
        ) : (
          <Avatar name={row.owner} src={avatar} size={36} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className={`truncate font-semibold ${noOwner ? "text-slate-500" : ""}`}>{row.owner}</h2>
          {position && <p className="truncate text-xs text-slate-500">{position}</p>}
        </div>
        {row.progress !== null && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${row.progress >= 100 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}
          >
            {row.progress}%
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs text-slate-500">Выручка за месяц</p>
        <div className="flex flex-wrap items-baseline gap-x-1">
          <span className="text-[22px] font-semibold tracking-tight tabular-nums">{formatRub(row.revenue)}</span>
          {!noOwner && <PlanForm key={`${month}-${row.plan}`} owner={row.owner} month={month} plan={row.plan} />}
        </div>
        <PlanBar row={row} showExpected={live} />
        {row.plan > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {left > 0 ? `Осталось ${formatRub(left)}` : left === 0 ? "План выполнен" : `План выполнен, сверх плана ${formatRub(-left)}`}
            {live && row.expectedSum > 0 && ` · ждём ещё ${formatRub(row.expectedSum)} по сделкам с закрытием в этом месяце`}
          </p>
        )}
        {row.plan <= 0 && live && row.expectedSum > 0 && (
          <p className="mt-1 text-xs text-slate-500">Ждём ещё {formatRub(row.expectedSum)} по сделкам с закрытием в этом месяце</p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
        <Stat label="Оплачено" value={String(row.won)} />
        <Stat label="Проиграно" value={String(row.lost)} note={row.lost ? formatRub(row.lostSum) : undefined} />
        <Stat label="Конверсия" value={pct(row.winRate)} />
        <Stat label="Средний чек" value={row.won ? formatRub(row.avgCheck) : "—"} />
        <Stat label="Новых сделок" value={String(row.started)} note={row.started ? formatRub(row.startedSum) : undefined} />
        {live && <Stat label="В работе" value={String(row.open)} note={row.open ? formatRub(row.openSum) : undefined} />}
      </dl>
    </section>
  );
}

// Вкладка «Менеджеры»: выручка каждого против плана на месяц, конверсия и сделки в работе
export async function ManagersView({ month: requested }: { month?: string }) {
  const current = monthKey(new Date());
  const latest = shiftMonth(current, 1);
  const month = isMonthKey(requested) && requested <= latest ? requested : current;
  const monthName = monthLabel(month);
  const live = month >= current;

  const [deals, employees, rawPlans] = await Promise.all([
    db.deal.findMany({
      select: { owner: true, amount: true, startDate: true, closedAt: true, expectedCloseDate: true, stage: { select: { kind: true } } },
    }),
    db.employee.findMany({ orderBy: { name: "asc" }, select: { name: true, position: true, avatar: true, blocked: true } }),
    getSetting(PLAN_SETTING),
  ]);
  const { rows, total } = managerReport(
    deals.map((d) => ({ ...d, kind: d.stage.kind })),
    month,
    parsePlans(rawPlans),
    current,
  );
  const people = new Map(employees.map((e) => [e.name, e]));
  const shown = new Set(rows.map((r) => r.owner));
  const addable = employees.filter((e) => !e.blocked && !shown.has(e.name)).map((e) => e.name);
  const closed = total.won + total.lost;
  const href = (m: string) => `/dashboard?view=managers${m === current ? "" : `&month=${m}`}`;
  const navClass = "flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Менеджер — ответственный в сделке. Выручка — оплаченные сделки по дате оплаты, конверсия — доля оплаченных среди закрытых за месяц.
        </p>
        <nav className="flex items-center gap-1 rounded-xl bg-white p-1 text-sm shadow-card" aria-label="Месяц">
          <Link href={href(shiftMonth(month, -1))} className={navClass} aria-label="Предыдущий месяц">
            <span className="rotate-90">
              <Icon name="chevron" size={16} />
            </span>
          </Link>
          <span className="min-w-32 px-2 text-center font-medium whitespace-nowrap">{monthName}</span>
          {month < latest ? (
            <Link href={href(shiftMonth(month, 1))} className={navClass} aria-label="Следующий месяц">
              <span className="-rotate-90">
                <Icon name="chevron" size={16} />
              </span>
            </Link>
          ) : (
            <span className="h-8 w-8" />
          )}
        </nav>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile
          label="План команды"
          value={total.plan > 0 ? pct(total.progress) : "—"}
          note={total.plan > 0 ? `${formatRub(total.revenue)} из ${formatRub(total.plan)}` : "План не поставлен"}
          tone={total.progress !== null && total.progress >= 100 ? "text-emerald-700" : ""}
        />
        <Tile label="Выручка" value={formatRub(total.revenue)} note={`${total.won} оплачено · средний чек ${total.won ? formatRub(total.avgCheck) : "—"}`} />
        <Tile label="Конверсия" value={pct(total.winRate)} note={`${total.won} из ${closed} закрытых`} tone="text-emerald-700" />
        {live ? (
          <Tile label="В работе" value={formatRub(total.openSum)} note={`${total.open} открытых сделок`} />
        ) : (
          <Tile label="Новые сделки" value={String(total.started)} note={formatRub(total.startedSum)} />
        )}
      </div>

      {rows.length ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const p = people.get(r.owner);
            return (
              <ManagerCard
                key={r.owner}
                row={r}
                month={month}
                live={live}
                avatar={p?.avatar ?? null}
                position={p?.position ?? null}
              />
            );
          })}
        </div>
      ) : (
        <p className={`${card} mb-6 text-sm text-slate-500`}>В этом месяце сделок не было. Поставьте менеджерам план, чтобы следить за выполнением.</p>
      )}

      {addable.length > 0 && (
        <section className={card}>
          <h2 className="font-semibold">Поставить план сотруднику</h2>
          <p className="mt-1 mb-3 text-sm text-slate-500">
            Для тех, у кого в этом месяце ещё нет ни плана, ни сделок. План действует и в следующие месяцы, пока его не поменяют.
          </p>
          <AddPlanForm month={month} names={addable} />
        </section>
      )}
    </div>
  );
}
