import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { emailDocumentAction, issueDocumentAction, sendToDiadocAction } from "@/app/finance/actions";
import { db } from "@/lib/db";
import { docTitle, getTochka } from "@/lib/finance/documents";
import { getDiadoc } from "@/lib/finance/diadoc-service";
import { formatDateTime, formatRub } from "@/lib/format";

export const STATUS_BADGE = {
  ISSUED: { label: "Ждёт оплаты", className: "bg-amber-50 text-amber-800" },
  PAID: { label: "Оплачен", className: "bg-emerald-50 text-emerald-700" },
  EXPIRED: { label: "Срок оплаты истёк", className: "bg-rose-50 text-rose-700" },
} as const;

// Счета и акты сделки: выставить в Точке, открыть PDF, отправить клиенту и в Диадок
export async function DealDocuments({ dealId, hasEmail }: { dealId: string; hasEmail: boolean }) {
  const [docs, tochka, diadoc] = await Promise.all([
    db.document.findMany({ where: { dealId }, orderBy: { createdAt: "asc" } }),
    getTochka(),
    getDiadoc().catch(() => null),
  ]);
  const hasInvoice = docs.some((d) => d.kind === "INVOICE");

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Счета и акты</h2>
        {tochka && (
          <div className="flex flex-wrap gap-2">
            <ActionButton
              action={issueDocumentAction.bind(null, dealId, "INVOICE")}
              label={hasInvoice ? "Ещё один счёт" : "Выставить счёт"}
              pendingLabel="Создаю в Точке…"
              primary={!hasInvoice}
            />
            <ActionButton
              action={issueDocumentAction.bind(null, dealId, "ACT")}
              label="Создать акт"
              pendingLabel="Создаю в Точке…"
              primary={hasInvoice}
            />
          </div>
        )}
      </div>
      {!tochka && (
        <p className="mt-2 text-sm text-slate-500">
          Подключите{" "}
          <Link href="/integrations/tochka" className="text-blue-600 hover:underline">
            Точку
          </Link>
          , чтобы выставлять счета и акты прямо из сделки.
        </p>
      )}
      {docs.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-[16rem] flex-1">
                <a href={`/api/documents/${d.id}/pdf`} target="_blank" className="font-medium text-blue-700 hover:underline">
                  {docTitle(d)}
                </a>
                <p className="text-sm text-slate-500">
                  {formatRub(d.amount)} · {d.title}
                  {d.paidAt && ` · оплачен ${d.paidAt.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}`}
                  {d.diadocAt && ` · в Диадоке с ${formatDateTime(d.diadocAt)}`}
                </p>
              </div>
              {d.kind === "INVOICE" && (
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[d.status].className}`}>
                  {STATUS_BADGE[d.status].label}
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                {hasEmail && <ActionButton action={emailDocumentAction.bind(null, d.id)} label="На почту клиенту" pendingLabel="Отправляю…" />}
                {d.kind === "ACT" && diadoc && (
                  <ActionButton
                    action={sendToDiadocAction.bind(null, d.id)}
                    label={d.diadocAt ? "В Диадок ещё раз" : "В Диадок"}
                    pendingLabel="Загружаю…"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
