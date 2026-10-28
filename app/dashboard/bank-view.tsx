import Link from "next/link";
import { db } from "@/lib/db";
import { formatRub } from "@/lib/format";
import { change, monthKey, monthLabel, shiftMonth } from "@/lib/monthly";
import { bankMonthlyStats, emptyBankMonth, topPayers, type BankMonth } from "@/lib/bank-stats";
import { CompareTile } from "./months-view";

const MONTHS_SHOWN = 12;

const dayFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });

// Вкладка «По банку»: деньги, которые реально пришли на счёт в Точке, по дате зачисления
export async function BankView() {
  const payments = await db.bankPayment.findMany({
    select: { date: true, amount: true, payerName: true, payerInn: true, documentId: true },
    orderBy: { date: "asc" },
  });

  if (!payments.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="max-w-md text-sm text-slate-600">
          Поступлений пока нет. Они приходят из выписки Точки: после подключения CRM загрузит историю за год и дальше будет
          обновлять её каждые 15 минут.
        </p>
        <Link href="/integrations/tochka" className="text-sm font-medium text-blue-600 hover:underline">
          Подключить Точку
        </Link>
      </div>
    );
  }

  const stats = bankMonthlyStats(payments);
  const at = (key: string): BankMonth => stats.get(key) ?? emptyBankMonth(key);
  const now = monthKey(new Date());
  const cur = at(now);
  const prev = at(shiftMonth(now, -1));
  const yearAgo = at(shiftMonth(now, -12));

  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => shiftMonth(now, i - MONTHS_SHOWN + 1));
  const rows = months.map((key) => ({ ...at(key), lastYear: at(shiftMonth(key, -12)).total }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.total, r.lastYear]));
  const totalYear = rows.reduce((a, r) => a + r.total, 0);
  const totalLastYear = rows.reduce((a, r) => a + r.lastYear, 0);

  const first = months[0];
  const top = topPayers(payments.filter((p) => monthKey(p.date) >= first));
  const topMax = Math.max(1, ...top.map((t) => t.total));

  return (
    <div>
      <p className="mb-6 text-sm text-slate-600">
        Поступления на расчётный счёт в Точке по дате зачисления, включая оплаты без счёта в CRM. Выписка загружена с{" "}
        {dayFmt.format(payments[0].date)}
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CompareTile label={`Поступления · ${monthLabel(now)}`} current={cur.total} prev={prev.total} yearAgo={yearAgo.total} money icon="wallet" tone="bg-blue-600" />
        <CompareTile label="Платежей" current={cur.count} prev={prev.count} yearAgo={yearAgo.count} icon="receipt" tone="bg-emerald-500" />
        <CompareTile label="Плательщиков" current={cur.payers} prev={prev.payers} yearAgo={yearAgo.payers} icon="clients" tone="bg-orange-400" />
        <CompareTile label="Средний платёж" current={cur.avg} prev={prev.avg} yearAgo={yearAgo.avg} money icon="check" tone="bg-sky-500" />
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white shadow-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-semibold">Поступления по месяцам</h2>
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
        <div className="mt-6 flex h-56 items-end gap-2" role="img" aria-label="Поступления по месяцам">
          {rows.map((r, i) => (
            <div key={r.key} className="group relative flex h-full flex-1 items-end justify-center gap-0.5">
              <div
                className="grow-y w-2/5 rounded-md bg-slate-200"
                style={{ height: `${(r.lastYear / max) * 100}%`, minHeight: r.lastYear ? 2 : 0, animationDelay: `${i * 30}ms` }}
              />
              <div
                className={`grow-y w-2/5 rounded-md ${r.key === now ? "bg-blue-600" : "bg-blue-300"} group-hover:bg-blue-500`}
                style={{ height: `${(r.total / max) * 100}%`, minHeight: r.total ? 2 : 0, animationDelay: `${i * 30}ms` }}
              />
              <div
                role="tooltip"
                className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:block ${
                  i < 2 ? "left-0" : i > MONTHS_SHOWN - 3 ? "right-0" : ""
                }`}
              >
                <p className="font-medium text-slate-900">{monthLabel(r.key)}</p>
                <p>Поступило: {formatRub(r.total)}</p>
                <p>Год назад: {formatRub(r.lastYear)}</p>
                <p>Платежей: {r.count}</p>
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

      <div className="grid gap-6">
        <section className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-card">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">По месяцам</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left whitespace-nowrap text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Месяц</th>
                <th className="px-4 py-3 text-right font-medium">Поступило</th>
                <th className="px-4 py-3 text-right font-medium">Год назад</th>
                <th className="px-4 py-3 text-right font-medium">Платежей</th>
                <th className="px-4 py-3 text-right font-medium">По счетам CRM</th>
                <th className="px-4 py-3 text-right font-medium">Без счёта</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...rows].reverse().map((r) => {
                const pct = change(r.total, r.lastYear);
                return (
                  <tr key={r.key} className={r.key === now ? "bg-blue-50/40" : "hover:bg-slate-50"}>
                    <td className="px-4 py-3 whitespace-nowrap">{monthLabel(r.key)}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{r.total ? formatRub(r.total) : "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-slate-600">
                      {r.lastYear ? formatRub(r.lastYear) : "—"}
                      {pct !== null && (
                        <span className={`ml-1 text-xs ${pct >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                          {pct >= 0 ? "+" : ""}
                          {pct}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.count || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-slate-600">{r.matched ? formatRub(r.matched) : "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-slate-600">{r.unmatched ? formatRub(r.unmatched) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-slate-200/60 bg-white shadow-card">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Крупнейшие плательщики за 12 месяцев</h2>
          {top.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">За 12 месяцев поступлений нет</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {top.map((t, i) => (
                <li key={`${t.inn ?? t.name}`} className="px-5 py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{t.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">{formatRub(t.total)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="grow-x h-full rounded-full bg-blue-500"
                        style={{ width: `${(t.total / topMax) * 100}%`, animationDelay: `${i * 40}ms` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">
                      {t.count} {plural(t.count)}
                      {t.inn && ` · ИНН ${t.inn}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function plural(n: number) {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return "платёж";
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "платежа";
  return "платежей";
}
