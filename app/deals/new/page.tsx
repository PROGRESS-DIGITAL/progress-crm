import { db } from "@/lib/db";
import { createDeal } from "../actions";
import { DealForm } from "../deal-form";

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const stages = await db.stage.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новая сделка</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <DealForm action={createDeal} stages={stages} submitLabel="Создать сделку" />
      </div>
    </div>
  );
}
