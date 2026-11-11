import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/format";
import { getCompanyOptions, getProductOptions, getStageOptions } from "@/lib/queries";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { DealContracts } from "@/components/deal-contracts";
import { DealMail } from "@/components/deal-mail";
import { DealDocuments } from "@/components/deal-documents";
import { DealProposals } from "@/components/deal-proposals";
import { LinkedEvents } from "@/components/linked-events";
import { deleteDeal, updateDeal } from "../actions";
import { DealForm } from "../deal-form";
import { getEmployeeNames } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, stages, companies, products, employees] = await Promise.all([
    db.deal.findUnique({ where: { id }, include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            contacts: { where: { email: { not: null } }, orderBy: { createdAt: "asc" }, select: { email: true }, take: 1 },
          },
        },
        contact: { select: { email: true } },
      },
    }),
    getStageOptions(),
    getCompanyOptions(),
    getProductOptions(),
    getEmployeeNames(),
  ]);
  if (!deal) notFound();
  // Кому писать: контакт сделки, иначе первый контакт клиента с почтой, иначе общая почта компании
  const mailTo = deal.contact?.email || deal.company.contacts[0]?.email || deal.company.email;

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link href={`/clients/${deal.company.id}`} className="text-blue-600 hover:underline">
              {deal.company.name}
            </Link>{" "}
            · создана {deal.createdAt.toLocaleDateString("ru-RU", { timeZone: TIME_ZONE })}
          </p>
        </div>
        <ConfirmDeleteButton
          action={deleteDeal.bind(null, deal.id)}
          what={`сделку «${deal.title}»`}
          message="Она попадёт в корзину: оттуда её можно восстановить в течение 30 дней."
        />
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
        <DealForm
          action={updateDeal.bind(null, deal.id)}
          stages={stages}
          companies={companies}
          products={products}
          employees={employees}
          submitLabel="Сохранить"
          initial={{
            ...deal,
            // Дата по Москве: сделка, созданная после полуночи, не должна «уезжать» на вчера
            startDate: deal.startDate.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" }),
            expectedCloseDate: deal.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
            closedAt: deal.closedAt?.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" }) ?? null,
          }}
        />
      </div>
      <LinkedEvents dealId={deal.id} />
      <DealProposals dealId={deal.id} />
      <DealContracts dealId={deal.id} />
      <DealMail to={mailTo} />
      <DealDocuments dealId={deal.id} hasEmail={!!deal.company.email} />
    </div>
  );
}
