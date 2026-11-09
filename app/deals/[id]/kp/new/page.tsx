import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { lastNote, productItem } from "@/lib/proposals/store";
import { periodLabel } from "@/lib/proposals/text";
import { ProposalPage } from "../page-shell";

export const dynamic = "force-dynamic";

// Новое КП: клиент, месяц и услуга сделки уже подставлены
export default async function NewProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await db.deal.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      amount: true,
      companyId: true,
      company: { select: { name: true } },
      product: { select: { id: true, name: true, kpText: true, unit: true } },
    },
  });
  if (!deal) notFound();
  // Прошлое КП этого клиента: из него берутся подпись на обложке и логотип
  const [previous, note] = await Promise.all([
    db.proposal.findFirst({
      where: { deal: { companyId: deal.companyId } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, client: true, logoMime: true },
    }),
    lastNote(),
  ]);
  return (
    <ProposalPage
      deal={deal}
      proposalId={null}
      initial={{
        client: previous?.client ?? deal.company.name,
        period: periodLabel(new Date()),
        note: note ?? "",
        items: deal.product ? [productItem(deal.product, deal.amount)] : [],
      }}
      logoFrom={previous?.logoMime ? previous.id : null}
      hasLogo={!!previous?.logoMime}
    />
  );
}
