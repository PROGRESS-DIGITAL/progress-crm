import { getCompanyOptions, getProductOptions, getStageOptions } from "@/lib/queries";
import { createDeal } from "../actions";
import { DealForm } from "../deal-form";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  const [stages, companies, products] = await Promise.all([
    getStageOptions(),
    getCompanyOptions(),
    getProductOptions(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новая сделка</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <DealForm
          action={createDeal}
          stages={stages}
          companies={companies}
          products={products}
          initial={{ companyId: companies.some((c) => c.id === companyId) ? companyId : "" }}
          submitLabel="Создать сделку"
        />
      </div>
    </div>
  );
}
