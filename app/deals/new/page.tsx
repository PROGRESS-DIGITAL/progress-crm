import { getCompanyOptions, getProductOptions, getStageOptions } from "@/lib/queries";
import { createDeal } from "../actions";
import { DealForm } from "../deal-form";
import { getOwner } from "@/lib/profile";
import { SALES_STEPS, isSalesStep } from "@/lib/sales-map";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; productId?: string; step?: string }>;
}) {
  const { companyId, productId, step } = await searchParams;
  const [stages, companies, products, owner] = await Promise.all([
    getStageOptions(),
    getCompanyOptions(),
    getProductOptions(),
    getOwner(),
  ]);
  // Переход из планограммы: подставляем шаг и, если есть, услугу из прайса с её ценой
  const product = products.find((p) => p.id === productId);
  const productStep = product?.salesStep;
  const salesStep = isSalesStep(step) ? step : isSalesStep(productStep) ? productStep : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-1 py-4 sm:px-3 sm:py-5">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новая сделка</h1>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
        <DealForm
          action={createDeal}
          stages={stages}
          companies={companies}
          products={products}
          initial={{
            owner: owner.name,
            startDate: new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" }),
            companyId: companies.some((c) => c.id === companyId) ? companyId : "",
            title: salesStep ? SALES_STEPS[salesStep] : "",
            salesStep,
            ...(product && { productId: product.id, service: product.service, amount: product.price }),
          }}
          submitLabel="Создать сделку"
        />
      </div>
    </div>
  );
}
