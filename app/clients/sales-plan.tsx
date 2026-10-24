import Link from "next/link";
import { SALES_STEPS, SITUATION_LABELS, isSituation, type ClientPlan } from "@/lib/sales-map";
import { newDealHref, type getStepProducts } from "@/lib/sales-map-data";

type StepProducts = Awaited<ReturnType<typeof getStepProducts>>;

export function SalesPlan({
  companyId,
  plan,
  manual,
  products,
}: {
  companyId: string;
  plan: ClientPlan;
  manual: string | null;
  products: StepProducts;
}) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Планограмма</h2>
        <Link href="/sales-map" className="text-sm text-blue-600 hover:underline">
          Вся схема →
        </Link>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Ситуация: <span className="font-medium text-slate-900">{SITUATION_LABELS[plan.situation]}</span>
        {!isSituation(manual) && <span className="text-slate-500"> (по оплаченным сделкам, можно указать в реквизитах)</span>}
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Пройдено</h3>
          {plan.done.length === 0 ? (
            <p className="text-sm text-slate-500">Оплаченных шагов пока нет</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {plan.done.map((s) => (
                <li key={s} className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                  ✓ {SALES_STEPS[s]}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">В работе</h3>
          {plan.inProgress.length === 0 ? (
            <p className="text-sm text-slate-500">Открытых шагов нет</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {plan.inProgress.map((s) => (
                <li key={s} className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-800">
                  {SALES_STEPS[s]}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Предложить дальше</h3>
          {plan.next.length === 0 ? (
            <p className="text-sm text-slate-500">По схеме всё предложено</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {plan.next.map((s) => (
                <li key={s} className="flex items-center justify-between gap-3 text-sm">
                  <span>{SALES_STEPS[s]}</span>
                  <Link
                    href={newDealHref(companyId, s, products.get(s)?.[0]?.id)}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                  >
                    + Сделка
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
