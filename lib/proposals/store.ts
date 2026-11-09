import { db } from "@/lib/db";
import { buildProposalPdf, type ProposalInput } from "./pdf";
import { parseItems, parsePages, periodLabel, proposalFileName, type ProposalItem } from "./text";

export const TEMPLATE_ID = 1;
export const MAX_TEMPLATE_SIZE = 25 * 1024 * 1024;
export const MAX_LOGO_SIZE = 5 * 1024 * 1024;

export async function getTemplateInfo() {
  return db.proposalTemplate.findUnique({
    where: { id: TEMPLATE_ID },
    select: { name: true, size: true, pages: true, cover: true, sample: true, intro: true, outro: true, updatedAt: true },
  });
}

async function templateInput() {
  const t = await db.proposalTemplate.findUnique({ where: { id: TEMPLATE_ID } });
  if (!t) return null;
  return {
    data: t.data,
    cover: t.cover,
    sample: t.sample,
    intro: parsePages(t.intro, t.pages) ?? [],
    outro: parsePages(t.outro, t.pages) ?? [],
  };
}

export async function renderProposal(id: string) {
  const kp = await db.proposal.findUnique({ where: { id } });
  if (!kp) return null;
  const bytes = await buildProposalPdf(
    {
      client: kp.client,
      period: kp.period,
      logo: kp.logo && kp.logoMime ? { data: kp.logo, mime: kp.logoMime } : null,
      items: parseItems(kp.items),
      note: kp.note,
    },
    await templateInput(),
  );
  return { bytes, name: proposalFileName(kp.client, kp.period), dealId: kp.dealId };
}

// Пример КП для проверки шаблона: вымышленный клиент и первые услуги прайса, у которых есть текст слайда
export async function renderSample() {
  const products = await db.product.findMany({
    where: { kpText: { not: null } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    take: 2,
  });
  const items: ProposalItem[] = products.length
    ? products.map((p) => productItem(p, p.price))
    : [
        {
          productId: null,
          title: "Пример услуги",
          text: "Текст слайда задаётся у услуги в «Прайсе».\n\nЭтапы работы:\n1. Первый этап.\n2. Второй этап.",
          price: 100_000,
          from: false,
          monthly: false,
          note: "",
        },
      ];
  const kp: ProposalInput = { client: "Пример клиента / отрасль", period: periodLabel(new Date()), logo: null, items, note: await lastNote() };
  return buildProposalPdf(kp, await templateInput());
}

export function pdfResponse(bytes: Uint8Array, name: string, download: boolean) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="kp.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

// Услуга из прайса в КП: «месяц» в единице — ежемесячная оплата
export function productItem(p: { id: string; name: string; kpText: string | null; unit: string | null }, price: number): ProposalItem {
  return {
    productId: p.id,
    title: p.name,
    text: p.kpText ?? "",
    price,
    from: false,
    monthly: /^мес/i.test(p.unit?.trim() ?? ""),
    note: "",
  };
}

// Примечание под итогом обычно одно и то же: берём из последнего КП
export async function lastNote() {
  return (await db.proposal.findFirst({ where: { note: { not: null } }, orderBy: { updatedAt: "desc" }, select: { note: true } }))?.note ?? null;
}
