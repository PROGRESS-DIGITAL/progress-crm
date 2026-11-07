import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { db } from "@/lib/db";
import { formatRub, SERVICE_LABELS } from "@/lib/format";
import { monthKey, monthLabel } from "@/lib/monthly";
import { activeIn, billingDayKey, monthlyTotal } from "@/lib/subscriptions";
import {
  deleteSubscription,
  saveSubscription,
  setSubscriptionActive,
} from "./subscription-actions";
import { SubscriptionForm } from "./subscription-form";

type Status = { label: string; className: string };

const BADGE = {
  paid: "bg-emerald-50 text-emerald-700",
  waiting: "bg-amber-50 text-amber-800",
  todo: "bg-blue-50 text-blue-700",
  lost: "bg-rose-50 text-rose-700",
  idle: "bg-slate-100 text-slate-600",
};

const day = (key: string) => Number(key.slice(8));

// Абонементы: кто платит каждый месяц, сколько и что с оплатой этого месяца
export async function Subscriptions({ edit }: { edit?: string }) {
  const month = monthKey(new Date());
  const [subs, companies] = await Promise.all([
    db.subscription.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      include: {
        company: { select: { id: true, name: true } },
        periods: {
          where: { month },
          include: {
            deal: {
              select: {
                id: true,
                stage: { select: { kind: true } },
                documents: {
                  where: { kind: "INVOICE" },
                  select: { status: true },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
    db.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const editing = edit ? subs.find((s) => s.id === edit) : undefined;

  const status = (s: (typeof subs)[number]): Status => {
    if (!activeIn(s, month))
      return {
        label: s.active ? "Не в этом месяце" : "На паузе",
        className: BADGE.idle,
      };
    const deal = s.periods[0]?.deal;
    if (!s.periods[0])
      return {
        label: `Счёт ${day(billingDayKey(month, s.billingDay))} числа`,
        className: BADGE.idle,
      };
    if (!deal) return { label: "Сделка месяца удалена", className: BADGE.idle };
    if (deal.stage.kind === "WON")
      return { label: "Оплачен", className: BADGE.paid };
    if (deal.stage.kind === "LOST")
      return { label: "Проиграна", className: BADGE.lost };
    if (deal.documents[0])
      return { label: "Счёт выставлен, ждёт оплаты", className: BADGE.waiting };
    return { label: "Выставить счёт", className: BADGE.todo };
  };

  const expected = monthlyTotal(subs, month);
  const thisMonth = subs.filter((s) => activeIn(s, month));
  const paid = thisMonth.filter(
    (s) => s.periods[0]?.deal?.stage.kind === "WON",
  );
  const paidSum = paid.reduce((a, s) => a + (s.periods[0]?.amount ?? 0), 0);

  const badge = (sub: (typeof subs)[number]) => {
    const st = status(sub);
    const deal = sub.periods[0]?.deal;
    const cls = `rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${st.className}`;
    return deal ? (
      <Link href={`/deals/${deal.id}`} className={`${cls} hover:underline`}>
        {st.label}
      </Link>
    ) : (
      <span className={cls}>{st.label}</span>
    );
  };

  const actions = (sub: (typeof subs)[number]) => (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/finance?view=subscriptions&edit=${sub.id}#subscription-form`}
        className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        Изменить
      </Link>
      <form action={setSubscriptionActive.bind(null, sub.id, !sub.active)}>
        <button
          type="submit"
          className="rounded-lg px-2 py-1 text-sm whitespace-nowrap text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          {sub.active ? "Пауза" : "Возобновить"}
        </button>
      </form>
      <ConfirmDeleteButton
        icon
        action={deleteSubscription.bind(null, sub.id)}
        label={`Удалить абонемент ${sub.company.name}`}
        what={`абонемент «${sub.title}» клиента ${sub.company.name}`}
        message="Новые сделки по нему заводиться не будут. Уже заведённые сделки и счета останутся."
      />
    </div>
  );

  const details = (sub: (typeof subs)[number]) =>
    `${SERVICE_LABELS[sub.service]} · с ${monthLabel(sub.startMonth, true)}${sub.endMonth ? ` по ${monthLabel(sub.endMonth, true)}` : ""}`;

  const card =
    "rounded-2xl border border-slate-200/60 bg-white p-3 shadow-card sm:p-5";
  const big =
    "mt-1 text-lg font-semibold tracking-tight tabular-nums sm:text-[26px]";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className={card}>
          <p className="text-xs text-slate-600 sm:text-sm">В месяц</p>
          <p className={big}>{formatRub(expected)}</p>
          <p className="text-xs text-slate-500">
            абонементов: {thisMonth.length}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-600 sm:text-sm">Оплачено</p>
          <p className={`${big} text-emerald-700`}>{formatRub(paidSum)}</p>
          <p className="text-xs text-slate-500">
            {paid.length} из {thisMonth.length} за {monthLabel(month, true)}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-600 sm:text-sm">Ещё ждём</p>
          <p className={`${big} text-amber-700`}>
            {formatRub(Math.max(0, expected - paidSum))}
          </p>
          <p className="hidden text-xs text-slate-500 sm:block">
            попадёт в выручку месяца после оплаты
          </p>
        </div>
      </div>

      {subs.length > 0 && (
        <section className="rounded-2xl border border-slate-200/60 bg-white shadow-card">
          <ul className="divide-y divide-slate-100 sm:hidden">
            {subs.map((sub) => (
              <li
                key={sub.id}
                className={`px-4 py-3 ${sub.active ? "" : "text-slate-400"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/clients/${sub.company.id}`}
                      className="font-medium hover:underline"
                    >
                      {sub.company.name}
                    </Link>
                    <p className="text-sm">{sub.title}</p>
                    <p className="text-xs text-slate-500">
                      {details(sub)} · счёт {sub.billingDay} числа
                    </p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums">
                    {formatRub(sub.amount)}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {badge(sub)}
                  {actions(sub)}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Клиент</th>
                  <th className="px-4 py-3 font-medium">Что входит</th>
                  <th className="px-4 py-3 text-right font-medium">В месяц</th>
                  <th className="px-4 py-3 font-medium">Счёт</th>
                  <th className="px-4 py-3 font-medium">{monthLabel(month)}</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subs.map((sub) => (
                  <tr
                    key={sub.id}
                    className={`hover:bg-slate-50 ${sub.active ? "" : "text-slate-400"}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${sub.company.id}`}
                        className="font-medium hover:underline"
                      >
                        {sub.company.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {sub.title}
                      <span className="block text-xs text-slate-500">
                        {details(sub)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {formatRub(sub.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sub.billingDay} числа
                    </td>
                    <td className="px-4 py-3">{badge(sub)}</td>
                    <td className="px-4 py-2">{actions(sub)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section
        id="subscription-form"
        className="scroll-mt-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card"
      >
        <h2 className="font-semibold">
          {editing
            ? `Изменить абонемент: ${editing.company.name}`
            : "Новый абонемент"}
        </h2>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          В день счёта CRM сама заведёт сделку месяца на этапе счёта и задачу
          «Выставить счёт», а бот напишет вам в Telegram. Счёт выставляется в
          карточке сделки, оплата переводит её в «Оплачен».
        </p>
        <SubscriptionForm
          key={editing?.id ?? "new"}
          action={saveSubscription.bind(null, editing?.id ?? null)}
          companies={companies}
          editing={!!editing}
          initial={editing ?? { startMonth: month }}
        />
      </section>
    </div>
  );
}
