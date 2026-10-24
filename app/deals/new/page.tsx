import { getCompanyOptions, getProductOptions, getStageOptions } from "@/lib/queries";
import { createDeal } from "../actions";
import { DealForm } from "../deal-form";
import { SALES_STEPS, isSalesStep } from "@/lib/sales-map";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; productId?: string; step?: string }>;
}) {
  const { companyId, productId, step } = await searchParams;
  const [stages, companies, products] = await Promise.all([
    getStageOptions(),
    getCompanyOptions(),
    getProductOptions(),
  ]);
  // Переход из планограммы: подставляем шаг и, если есть, услугу из прайса с её ценой
  const product = products.find((p) => p.id === productId);
  const productStep = product?.salesStep;
  const salesStep = isSalesStep(step) ? step : isSalesStep(productStep) ? productStep : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новая сделка</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <DealForm
          action={createDeal}
          stages={stages}
          companies={companies}
          products={products}
          initial={{
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
