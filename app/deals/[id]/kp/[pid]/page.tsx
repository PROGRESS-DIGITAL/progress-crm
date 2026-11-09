import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseItems } from "@/lib/proposals/text";
import { ProposalPage } from "../page-shell";

export const dynamic = "force-dynamic";

export default async function EditProposalPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const kp = await db.proposal.findUnique({
    where: { id: pid },
    select: {
      id: true,
      dealId: true,
      client: true,
      period: true,
      note: true,
      items: true,
      logoMime: true,
      deal: { select: { id: true, title: true, company: { select: { name: true } } } },
    },
  });
  if (!kp || kp.dealId !== id) notFound();
  return (
    <ProposalPage
      deal={kp.deal}
      proposalId={kp.id}
      initial={{ client: kp.client, period: kp.period, note: kp.note ?? "", items: parseItems(kp.items) }}
      logoFrom={null}
      hasLogo={!!kp.logoMime}
    />
  );
}
