import Link from "next/link";
import { db } from "@/lib/db";
import { getTemplateInfo } from "@/lib/proposals/store";
import { ProposalForm, type PriceProduct } from "./proposal-form";
import type { ProposalItem } from "@/lib/proposals/text";

// Общая обёртка страниц «Новое КП» и «Изменить КП»
export async function ProposalPage({
  deal,
  proposalId,
  initial,
  logoFrom,
  hasLogo,
}: {
  deal: { id: string; title: string; company: { name: string } };
  proposalId: string | null;
  initial: { client: string; period: string; note: string; items: ProposalItem[] };
  logoFrom: string | null;
  hasLogo: boolean;
}) {
  const [products, template] = await Promise.all([
    db.product.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, category: true, name: true, price: true, unit: true, kpText: true },
    }),
    getTemplateInfo(),
  ]);
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <p className="text-sm">
        <Link href={`/deals/${deal.id}#kp`} className="text-blue-600 hover:underline">
          ← {deal.title}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{proposalId ? "Изменить КП" : "Новое КП"}</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        {deal.company.name}.{" "}
        {template ? (
          <>
            Слайды о студии и контакты возьмутся из{" "}
            <Link href="/price/kp" className="text-blue-600 hover:underline">
              шаблона КП
            </Link>
            .
          </>
        ) : (
          <>
            Шаблон КП не загружен, поэтому в PDF будут только обложка, услуги и стоимость.{" "}
            <Link href="/price/kp" className="text-blue-600 hover:underline">
              Загрузить презентацию студии
            </Link>
          </>
        )}
      </p>
      <ProposalForm
        dealId={deal.id}
        proposalId={proposalId}
        initial={initial}
        products={products as PriceProduct[]}
        logoFrom={logoFrom}
        hasLogo={hasLogo}
      />
    </div>
  );
}
