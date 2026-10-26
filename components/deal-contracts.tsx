import Link from "next/link";
import { db } from "@/lib/db";
import { dayKey } from "@/lib/calendar";
import { shortDate } from "@/lib/contracts/fields";
import { ensureDefaultTemplate, nextContractNumber } from "@/lib/contracts/store";
import { CreateContractForm } from "./create-contract-form";

// Договоры сделки и создание нового по шаблону с данными клиента и сделки
export async function DealContracts({ dealId }: { dealId: string }) {
  await ensureDefaultTemplate();
  const [contracts, templates, number] = await Promise.all([
    db.contract.findMany({ where: { dealId }, orderBy: { createdAt: "asc" } }),
    db.contractTemplate.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    nextContractNumber(),
  ]);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Договор</h2>
        <Link href="/documents?tab=templates" className="text-sm text-blue-600 hover:underline">
          Шаблоны
        </Link>
      </div>
      {contracts.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {contracts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <Link href={`/documents/contracts/${c.id}`} className="font-medium text-blue-700 hover:underline">
                Договор № {c.number} от {shortDate(c.date)}
              </Link>
              <span className="text-slate-500">{c.title}</span>
            </li>
          ))}
        </ul>
      )}
      {templates.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          Шаблонов нет.{" "}
          <Link href="/documents?tab=templates" className="text-blue-600 hover:underline">
            Загрузите договор
          </Link>
          , чтобы создавать по нему.
        </p>
      ) : (
        <CreateContractForm dealId={dealId} templates={templates} number={number} today={dayKey(new Date())} again={contracts.length > 0} />
      )}
    </section>
  );
}
