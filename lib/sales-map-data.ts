import { db } from "@/lib/db";
import { clientPlan, isSalesStep, type SalesStep } from "@/lib/sales-map";

// Шаг сделки: выбранный в сделке, иначе шаг её услуги из прайса
function dealStep(d: { salesStep: string | null; product: { salesStep: string | null } | null }): SalesStep | null {
  const step = d.salesStep ?? d.product?.salesStep;
  return isSalesStep(step) ? step : null;
}

const dealSelect = {
  salesStep: true,
  stage: { select: { kind: true } },
  product: { select: { salesStep: true } },
} as const;

export async function getClientPlan(companyId: string, situation: string | null) {
  const deals = await db.deal.findMany({ where: { companyId }, select: dealSelect });
  return clientPlan(
    deals.map((d) => ({ step: dealStep(d), kind: d.stage.kind })),
    situation,
  );
}

export async function getAllPlans() {
  const companies = await db.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, situation: true, deals: { select: dealSelect } },
  });
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    plan: clientPlan(
      c.deals.map((d) => ({ step: dealStep(d), kind: d.stage.kind })),
      c.situation,
    ),
  }));
}

// Услуги прайса по шагам: подставляются в новую сделку и показывают цену на схеме
export async function getStepProducts() {
  const products = await db.product.findMany({
    where: { salesStep: { not: null } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, price: true, unit: true, salesStep: true },
  });
  const byStep = new Map<SalesStep, typeof products>();
  for (const p of products) {
    if (!isSalesStep(p.salesStep)) continue;
    byStep.set(p.salesStep, [...(byStep.get(p.salesStep) ?? []), p]);
  }
  return byStep;
}

export function newDealHref(companyId: string, step: SalesStep, productId?: string) {
  const params = new URLSearchParams({ companyId, step });
  if (productId) params.set("productId", productId);
  return `/deals/new?${params}`;
}
