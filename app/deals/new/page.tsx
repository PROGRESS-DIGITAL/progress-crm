import { getCompanyOptions, getProductOptions, getStageOptions } from "@/lib/queries";
import { createDeal } from "../actions";
import { DealLinkList, DealLinks, DealLinksCard } from "@/components/deal-links";
import { linkOptions, sourceLinks } from "@/lib/links";
import { DealForm } from "../deal-form";
import { actorName } from "@/lib/auth/session";
import { getEmployeeNames } from "@/lib/profile";
import { SALES_STEPS, isSalesStep } from "@/lib/sales-map";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; productId?: string; step?: string; fromDeal?: string; fromEvent?: string }>;
}) {
  const { companyId, productId, step, fromDeal, fromEvent } = await searchParams;
  const [stages, companies, products, owner, employees, links, options] = await Promise.all([
    getStageOptions(),
    getCompanyOptions(),
    getProductOptions(),
    actorName(),
    getEmployeeNames(),
    sourceLinks(fromDeal, fromEvent),
    linkOptions(),
  ]);
  // Переход из планограммы: подставляем шаг и, если есть, услугу из прайса с её ценой
  const product = products.find((p) => p.id === productId);
  const productStep = product?.salesStep;
  const salesStep = isSalesStep(step) ? step : isSalesStep(productStep) ? productStep : null;

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <DealLinks dealId={null} links={links} options={options} form="deal-form">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Новая сделка</h1>
        <DealLinkList />
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
        <DealForm
          action={createDeal}
          formId="deal-form"
          stages={stages}
          companies={companies}
          products={products}
          employees={employees}
          initial={{
            owner,
            startDate: new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" }),
            companyId: companies.some((c) => c.id === companyId) ? companyId : "",
            title: salesStep ? SALES_STEPS[salesStep] : "",
            salesStep,
            ...(product && { productId: product.id, service: product.service, amount: product.price }),
          }}
          submitLabel="Создать сделку"
        />
      </div>
      <DealLinksCard />
      </DealLinks>
    </div>
  );
}
