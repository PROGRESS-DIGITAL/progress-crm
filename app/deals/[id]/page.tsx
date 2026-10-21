import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteDeal, updateDeal } from "../actions";
import { DealForm } from "../deal-form";
import { DeleteDealButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, stages] = await Promise.all([
    db.deal.findUnique({ where: { id } }),
    db.stage.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!deal) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Создана {deal.createdAt.toLocaleDateString("ru-RU")}
          </p>
        </div>
        <DeleteDealButton action={deleteDeal.bind(null, deal.id)} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <DealForm
          action={updateDeal.bind(null, deal.id)}
          stages={stages}
          submitLabel="Сохранить"
          initial={{
            ...deal,
            expectedCloseDate: deal.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
          }}
        />
      </div>
    </div>
  );
}
