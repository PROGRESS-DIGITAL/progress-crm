import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { GROWTH_STEPS, SALES_COLUMNS, SALES_STEPS, type SalesStep, type Situation } from "@/lib/sales-map";
import { getAllPlans, getStepProducts } from "@/lib/sales-map-data";
import { FOLLOW_UP_OPTIONS, followUpDays } from "@/lib/follow-ups";
import { saveFollowUpDays } from "./actions";
import { FollowUpForm } from "./follow-up-form";

export const dynamic = "force-dynamic";

// Цвета блоков как на схеме агентства
const COLUMN_TONE: Record<Situation, string> = {
  idea: "border-emerald-200 bg-emerald-50",
  noLogo: "border-yellow-200 bg-yellow-50",
  hasLogo: "border-amber-200 bg-amber-50",
  hasSite: "border-amber-200 bg-amber-50",
  complex: "border-blue-200 bg-blue-50",
};
const STEP_TONE: Partial<Record<SalesStep, string>> = {
  ai: "border-green-200 bg-green-50",
  productDev: "border-sky-200 bg-sky-50",
  remoteMarketing: "border-sky-200 bg-sky-50",
};

type Plans = Awaited<ReturnType<typeof getAllPlans>>;
type StepProducts = Awaited<ReturnType<typeof getStepProducts>>;

function StepCard({
  step,
  plans,
  products,
  tone,
  situation,
}: {
  step: SalesStep;
  plans: Plans;
  products: StepProducts;
  tone: string;
  // Шаг, который стоит в нескольких колонках (сайты, ИИ): клиента показываем в колонке его ситуации
  situation?: Situation;
}) {
  const done = plans.filter((c) => c.plan.done.includes(step));
  const working = plans.filter((c) => c.plan.inProgress.includes(step));
  const offer = plans.filter((c) => c.plan.next.includes(step) && (!situation || c.plan.situation === situation));
  const items = products.get(step) ?? [];

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <p className="text-sm font-semibold text-slate-900">{SALES_STEPS[step]}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {items.length ? items.map((p) => `${p.name} — ${formatPrice(p)}`).join(" · ") : "Нет в прайсе"}
      </p>
      <dl className="mt-2 flex gap-3 text-xs text-slate-600">
        <div>
          <dt className="sr-only">Оплатили</dt>
          <dd title="Оплатили">✓ {done.length}</dd>
        </div>
        <div>
          <dt className="sr-only">В работе</dt>
          <dd title="В работе">◷ {working.length}</dd>
        </div>
      </dl>
      {offer.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium text-blue-700">Предложить: {offer.length}</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {offer.map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="text-slate-700 hover:text-blue-700">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const SHARED = new Set(SALES_COLUMNS.flatMap((c) => c.steps).filter((s, i, all) => all.indexOf(s) !== i));

export default async function SalesMapPage() {
  const [plans, products, days] = await Promise.all([getAllPlans(), getStepProducts(), followUpDays()]);

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <h1 className="text-2xl font-semibold tracking-tight">Планограмма продаж</h1>
      <p className="mt-1 mb-4 max-w-3xl text-sm text-slate-600">
        С чем клиент приходит и что ему продавать дальше. ✓ — оплатили, ◷ — в работе, «Предложить» — клиенты, которым
        этот шаг следующий по схеме. Схема идёт по нарастающей: то, что левее ситуации клиента, ему уже не предлагаем. Услуги прайса привязываются к шагам в «Прайсе», ситуация клиента — в его реквизитах.
      </p>
      <div className="mb-6 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card">
        <FollowUpForm action={saveFollowUpDays} days={days} options={FOLLOW_UP_OPTIONS} />
        <p className="mt-2 text-xs text-slate-500">
          {days
            ? `Через ${days} дней после оплаты CRM поставит задачу «Предложить следующий шаг» с подсказкой из схемы и напишет вам в Telegram. Если клиенту уже что-то продаём, напоминания не будет.`
            : "Напоминания выключены."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {SALES_COLUMNS.map((col) => {
          const clients = plans.filter((c) => c.plan.situation === col.situation);
          return (
            <section key={col.situation} className="flex flex-col gap-2">
              <header className="mb-1">
                <h2 className="text-sm font-semibold text-slate-800">{col.title}</h2>
                <p className="text-xs text-slate-500">Клиентов: {clients.length}</p>
              </header>
              {col.siteGroup && (
                <p className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {col.siteGroup}
                </p>
              )}
              {col.steps.map((step) => (
                <StepCard
                  key={step}
                  step={step}
                  plans={plans}
                  products={products}
                  situation={SHARED.has(step) ? col.situation : undefined}
                  tone={STEP_TONE[step] ?? COLUMN_TONE[col.situation]}
                />
              ))}
            </section>
          );
        })}
      </div>

      <section className="mt-8">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Продвижение после сайта</h2>
        <p className="mb-3 text-xs text-slate-500">Общий блок для всех клиентов с сайтом</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {GROWTH_STEPS.map((step) => (
            <StepCard
              key={step}
              step={step}
              plans={plans}
              products={products}
              tone={STEP_TONE[step] ?? "border-slate-200 bg-slate-50"}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
