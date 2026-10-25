import Link from "next/link";
import { ClientsView } from "./clients-view";
import { MonthsView } from "./months-view";

export const dynamic = "force-dynamic";

const TABS = [
  { view: "months", label: "По месяцам" },
  { view: "clients", label: "По клиентам" },
] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === "clients" ? "clients" : "months";
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <nav className="flex rounded-lg bg-slate-100 p-1 text-sm" aria-label="Вид дашборда">
          {TABS.map((t) => (
            <Link
              key={t.view}
              href={t.view === "months" ? "/dashboard" : `/dashboard?view=${t.view}`}
              aria-current={view === t.view ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 ${view === t.view ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {view === "months" ? <MonthsView /> : <ClientsView />}
    </div>
  );
}
