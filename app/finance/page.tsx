import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { STATUS_BADGE } from "@/components/deal-documents";
import { db } from "@/lib/db";
import { docTitle, getTochka } from "@/lib/finance/documents";
import { formatDateTime, formatRub } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { deleteDocumentAction, syncPaymentsAction } from "./actions";

export const dynamic = "force-dynamic";

const TABS = [
  { view: "invoices", label: "Счета" },
  { view: "acts", label: "Акты" },
  { view: "payments", label: "Поступления" },
] as const;

const day = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const v = (await searchParams).view;
  const view = v === "acts" || v === "payments" ? v : "invoices";
  const [tochka, waiting] = await Promise.all([
    getTochka(),
    db.document.aggregate({ where: { kind: "INVOICE", status: { not: "PAID" } }, _sum: { amount: true }, _count: true }),
  ]);

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Финансы</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ждут оплаты: {waiting._count} {waiting._count === 1 ? "счёт" : "счетов"} на {formatRub(waiting._sum.amount ?? 0)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {tochka ? (
            <ActionButton action={syncPaymentsAction} label="Обновить оплаты" pendingLabel="Запрашиваю выписку…" />
          ) : (
            <Link
              href="/integrations/tochka"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
            >
              Подключить Точку
            </Link>
          )}
          <nav className="flex rounded-xl bg-white p-1 text-sm shadow-card" aria-label="Раздел финансов">
            {TABS.map((t) => (
              <Link
                key={t.view}
                href={t.view === "invoices" ? "/finance" : `/finance?view=${t.view}`}
                aria-current={view === t.view ? "page" : undefined}
                className={`rounded-lg px-4 py-1.5 ${view === t.view ? "bg-blue-600 font-medium text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                {t.label}
              </Link>
            ))}
            <Link href="/documents" className="rounded-lg px-4 py-1.5 text-slate-600 hover:text-slate-900">
              Договоры
            </Link>
          </nav>
        </div>
      </div>
      {view === "payments" ? <Payments /> : <Documents kind={view === "acts" ? "ACT" : "INVOICE"} />}
    </div>
  );
}

async function Documents({ kind }: { kind: "INVOICE" | "ACT" }) {
  const docs = await db.document.findMany({
    where: { kind },
    orderBy: [{ year: "desc" }, { seq: "desc" }],
    include: { company: { select: { id: true, name: true } }, deal: { select: { id: true, title: true } } },
    take: 300,
  });
  if (!docs.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        {kind === "INVOICE" ? "Счетов пока нет." : "Актов пока нет."} Их выставляют из карточки сделки.
      </p>
    );
  }
  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Документ</th>
            <th className="px-4 py-3 font-medium">Клиент</th>
            <th className="px-4 py-3 font-medium">Сделка</th>
            <th className="px-4 py-3 text-right font-medium">Сумма</th>
            <th className="px-4 py-3 font-medium">{kind === "INVOICE" ? "Оплата" : "Диадок"}</th>
            <th className="w-12 px-2 py-3">
              <span className="sr-only">Удалить</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {docs.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <a href={`/api/documents/${d.id}/pdf`} target="_blank" className="font-medium text-blue-700 hover:underline">
                  {docTitle(d)}
                </a>
              </td>
              <td className="px-4 py-3">
                <Link href={`/clients/${d.company.id}`} className="hover:underline">
                  {d.company.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <Link href={`/deals/${d.deal.id}`} className="hover:underline">
                  {d.deal.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatRub(d.amount)}</td>
              <td className="px-4 py-3">
                {kind === "INVOICE" ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[d.status].className}`}>
                    {STATUS_BADGE[d.status].label}
                    {d.paidAt && ` ${day(d.paidAt)}`}
                  </span>
                ) : (
                  <span className="text-slate-600">{d.diadocAt ? `Черновик с ${formatDateTime(d.diadocAt)}` : "—"}</span>
                )}
              </td>
              <td className="px-2 py-1.5">
                <ConfirmDeleteButton
                  icon
                  action={deleteDocumentAction.bind(null, d.id)}
                  label={`Удалить ${docTitle(d).toLowerCase()}`}
                  message={`Удалить ${docTitle(d).toLowerCase()} из CRM? В Точке${kind === "ACT" ? " и Диадоке" : ""} он останется.`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function Payments() {
  const payments = await db.bankPayment.findMany({
    orderBy: { date: "desc" },
    take: 300,
    include: { document: { select: { id: true, kind: true, seq: true, date: true, dealId: true } } },
  });
  if (!payments.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Поступлений пока нет. Они подтягиваются из выписки Точки каждые 15 минут.
      </p>
    );
  }
  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Дата</th>
            <th className="px-4 py-3 font-medium">Плательщик</th>
            <th className="px-4 py-3 font-medium">Назначение</th>
            <th className="px-4 py-3 text-right font-medium">Сумма</th>
            <th className="px-4 py-3 font-medium">Счёт</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">{day(p.date)}</td>
              <td className="px-4 py-3">
                {p.payerName ?? "—"}
                {p.payerInn && <span className="block text-xs text-slate-500">ИНН {p.payerInn}</span>}
              </td>
              <td className="max-w-md px-4 py-3 text-slate-600">
                <span className="line-clamp-2 whitespace-normal">{p.purpose ?? "—"}</span>
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-700">+{formatRub(p.amount)}</td>
              <td className="px-4 py-3">
                {p.document ? (
                  <Link href={`/deals/${p.document.dealId}`} className="text-blue-700 hover:underline">
                    {docTitle(p.document)}
                  </Link>
                ) : (
                  <span className="text-slate-400">не найден</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
