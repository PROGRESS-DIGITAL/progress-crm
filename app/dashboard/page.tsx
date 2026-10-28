import Link from "next/link";
import { BankView } from "./bank-view";
import { ClientsView } from "./clients-view";
import { FinModelView } from "./finmodel-view";
import { MonthsView } from "./months-view";

export const dynamic = "force-dynamic";

const TABS = [
  { view: "months", label: "По месяцам" },
  { view: "clients", label: "По клиентам" },
  { view: "bank", label: "По банку" },
  { view: "plan", label: "Финмодель" },
] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const requested = (await searchParams).view;
  const view = TABS.find((t) => t.view === requested)?.view ?? "months";
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <nav className="grid w-full grid-cols-2 rounded-xl bg-white p-1 text-sm shadow-card sm:flex sm:w-auto" aria-label="Вид дашборда">
          {TABS.map((t) => (
            <Link
              key={t.view}
              href={t.view === "months" ? "/dashboard" : `/dashboard?view=${t.view}`}
              aria-current={view === t.view ? "page" : undefined}
              className={`rounded-lg px-4 py-1.5 text-center whitespace-nowrap ${view === t.view ? "bg-blue-600 font-medium text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {view === "months" ? <MonthsView /> : view === "clients" ? <ClientsView /> : view === "bank" ? <BankView /> : <FinModelView />}
    </div>
  );
}
