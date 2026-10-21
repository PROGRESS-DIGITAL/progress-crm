import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LEAD_STATUS_BADGE, LEAD_STATUS_LABELS, formatDateTime } from "@/lib/format";
import { convertLead, rejectLead, setLeadStatus } from "../actions";
import { ConvertForm, RejectForm } from "./lead-actions";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, companies] = await Promise.all([
    db.lead.findUnique({ where: { id }, include: { deal: { select: { id: true, title: true } } } }),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!lead) notFound();

  const who = lead.name ?? lead.phone ?? lead.email ?? "Без имени";
  // Если компания из заявки уже есть в базе, сразу предлагаем её
  const known = lead.companyName
    ? companies.find((c) => c.name.toLowerCase() === lead.companyName!.toLowerCase())
    : undefined;
  const details: [string, string | null][] = [
    ["Телефон", lead.phone],
    ["Email", lead.email],
    ["Компания", lead.companyName],
    ["Форма", lead.formName],
    ["Страница", lead.pageUrl],
    ["UTM source", lead.utmSource],
    ["UTM medium", lead.utmMedium],
    ["UTM campaign", lead.utmCampaign],
    ["UTM content", lead.utmContent],
    ["UTM term", lead.utmTerm],
    ["Ответственный", lead.owner],
  ];
  const open = lead.status === "NEW" || lead.status === "IN_PROGRESS";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/leads" className="text-sm text-slate-500 hover:text-slate-800">
        ← Лиды
      </Link>
      <div className="mt-1 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{who}</h1>
        <span className={`rounded px-2 py-0.5 text-xs ${LEAD_STATUS_BADGE[lead.status]}`}>
          {LEAD_STATUS_LABELS[lead.status]}
        </span>
        <span className="text-sm text-slate-500">
          {lead.source === "TILDA" ? "Тильда" : "Вручную"} · {formatDateTime(lead.createdAt)}
        </span>
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        {lead.message && <p className="mb-4 whitespace-pre-line text-sm">{lead.message}</p>}
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {details
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
        </dl>
      </section>

      {lead.status === "CONVERTED" && lead.deal && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Создана сделка{" "}
          <Link href={`/deals/${lead.deal.id}`} className="font-medium underline">
            {lead.deal.title}
          </Link>
        </p>
      )}

      {lead.status === "REJECTED" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <span>Отклонён: {lead.rejectReason}</span>
          <form action={setLeadStatus.bind(null, lead.id, "NEW")}>
            <button type="submit" className="text-blue-600 hover:underline">
              Вернуть в новые
            </button>
          </form>
        </div>
      )}

      {open && (
        <>
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Создать сделку</h2>
              {lead.status === "NEW" && (
                <form action={setLeadStatus.bind(null, lead.id, "IN_PROGRESS")}>
                  <button type="submit" className="text-sm font-medium text-blue-600 hover:underline">
                    Взять в работу
                  </button>
                </form>
              )}
            </div>
            <ConvertForm
              action={convertLead.bind(null, lead.id)}
              companies={companies}
              initial={{
                companyId: known?.id ?? "",
                companyName: lead.companyName ?? lead.name ?? "",
                title: lead.formName ? `Заявка с сайта: ${lead.formName}` : `Заявка: ${who}`,
                owner: lead.owner ?? "",
                service: "WEBSITE",
              }}
            />
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-semibold">Не подходит</h2>
            <RejectForm action={rejectLead.bind(null, lead.id)} />
          </section>
        </>
      )}
    </div>
  );
}
