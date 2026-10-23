import type { StageKind } from "@prisma/client";

export type ClientDeal = { amount: number; stage: { kind: StageKind } };

export type ClientLtv = {
  id: string;
  name: string;
  // LTV: сумма всех оплаченных сделок клиента
  ltv: number;
  paidDeals: number;
  // Сумма открытых сделок: то, что ещё может стать оплатой
  open: number;
  openDeals: number;
  avgCheck: number;
};

export function clientLtv(company: { id: string; name: string; deals: ClientDeal[] }): ClientLtv {
  const paid = company.deals.filter((d) => d.stage.kind === "WON");
  const open = company.deals.filter((d) => d.stage.kind === "OPEN");
  const ltv = paid.reduce((a, d) => a + d.amount, 0);
  return {
    id: company.id,
    name: company.name,
    ltv,
    paidDeals: paid.length,
    open: open.reduce((a, d) => a + d.amount, 0),
    openDeals: open.length,
    avgCheck: paid.length ? Math.round(ltv / paid.length) : 0,
  };
}

// Сначала по LTV, при равном — по сумме в работе
export function rankClients(rows: ClientLtv[]) {
  return [...rows].sort((a, b) => b.ltv - a.ltv || b.open - a.open || a.name.localeCompare(b.name));
}
