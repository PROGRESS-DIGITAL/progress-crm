import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dayKey } from "@/lib/calendar";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { deleteContract, saveContract } from "../../actions";
import { ContractEditor } from "./contract-editor";

export const dynamic = "force-dynamic";

export default async function ContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ missing?: string }>;
}) {
  const [{ id }, { missing }] = await Promise.all([params, searchParams]);
  const contract = await db.contract.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true } }, deal: { select: { id: true, title: true } } },
  });
  if (!contract) notFound();
  const gaps = missing?.split("|").filter(Boolean) ?? [];

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <Link href={contract.deal ? `/deals/${contract.deal.id}` : "/documents"} className="text-sm text-blue-600 hover:underline">
            ← {contract.deal ? contract.deal.title : "Документы"}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Договор № {contract.number}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {contract.company && (
              <Link href={`/clients/${contract.company.id}`} className="text-blue-600 hover:underline">
                {contract.company.name}
              </Link>
            )}
            {contract.company && " · "}
            {contract.title}
          </p>
        </div>
        <ConfirmDeleteButton
          action={deleteContract.bind(null, contract.id)}
          what={`договор № ${contract.number}`}
          message="Это действие нельзя отменить."
        />
      </div>
      {gaps.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          <p>
            Не хватило данных, в договоре на их месте черта: {gaps.join(", ")}. Впишите их прямо в договор или дополните{" "}
            {contract.company && (
              <Link href={`/clients/${contract.company.id}`} className="font-medium underline">
                карточку клиента
              </Link>
            )}
            {contract.company && " и "}
            <Link href="/documents?tab=requisites" className="font-medium underline">
              свои реквизиты
            </Link>{" "}
            и создайте договор заново.
          </p>
        </div>
      )}
      <ContractEditor
        action={saveContract.bind(null, contract.id)}
        id={contract.id}
        number={contract.number}
        date={dayKey(contract.date)}
        body={contract.body}
      />
    </div>
  );
}
