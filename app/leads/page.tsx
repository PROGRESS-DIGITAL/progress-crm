import Link from "next/link";
import type { LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_BADGE, LEAD_STATUS_LABELS, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS: (LeadStatus | "ALL")[] = ["NEW", "IN_PROGRESS", "CONVERTED", "REJECTED", "ALL"];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requested = (await searchParams).status;
  const status = TABS.includes(requested as LeadStatus) ? (requested as LeadStatus | "ALL") : "NEW";

  const [leads, counts] = await Promise.all([
    db.lead.findMany({
      where: status === "ALL" ? undefined : { status },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.lead.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: LeadStatus | "ALL") =>
    s === "ALL" ? counts.reduce((a, c) => a + c._count, 0) : (counts.find((c) => c.status === s)?._count ?? 0);

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Лиды</h1>
          <p className="mt-1 text-sm text-slate-600">Заявки с сайта, из чатов и добавленные вручную</p>
        </div>
        <Link
          href="/leads/new"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
        >
          + Новый лид
        </Link>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/leads?status=${t}`}
            className={`rounded-full px-3 py-1 ${t === status ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {t === "ALL" ? "Все" : LEAD_STATUS_LABELS[t]} · {countOf(t)}
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Здесь пока пусто
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Когда</th>
                <th className="px-4 py-3 font-medium">Кто</th>
                <th className="px-4 py-3 font-medium">Контакты</th>
                <th className="px-4 py-3 font-medium">Источник</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                      {l.name ?? l.phone ?? l.email ?? "Без имени"}
                    </Link>
                    {l.companyName && <span className="text-slate-500"> · {l.companyName}</span>}
                    {l.message && <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-slate-500">{l.message}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{[l.phone, l.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {`${LEAD_SOURCE_LABELS[l.source]}${l.source !== "MANUAL" && l.formName ? ` · ${l.formName}` : ""}`}
                    {l.utmSource && <span className="block text-xs text-slate-500">{[l.utmSource, l.utmMedium].filter(Boolean).join(" / ")}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${LEAD_STATUS_BADGE[l.status]}`}>
                      {LEAD_STATUS_LABELS[l.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
