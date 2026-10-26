export type OpenInvoice = { id: string; seq: number; amount: number; inn: string | null; date: Date };
export type IncomingPayment = { amount: number; payerInn: string | null; purpose: string | null };

// Номер счёта из назначения платежа: «Оплата по счёту № 12 от 26.10.2026», «сч. №12», «по счету 12»
export function invoiceNumberFromPurpose(purpose: string | null): number | null {
  const m = purpose?.match(/сч(?:[её]т[уа]?|\.)?\s*(?:на оплату\s*)?№?\s*(\d{1,6})(?!\d)/i);
  return m ? Number(m[1]) : null;
}

// Какой счёт оплачен: сначала по номеру из назначения (с проверкой ИНН или суммы),
// иначе самый ранний неоплаченный счёт этого плательщика на ту же сумму
export function matchInvoice(p: IncomingPayment, open: OpenInvoice[]): string | null {
  const num = invoiceNumberFromPurpose(p.purpose);
  if (num !== null) {
    const byNumber = open.find((i) => i.seq === num && ((p.payerInn && i.inn === p.payerInn) || i.amount === p.amount));
    if (byNumber) return byNumber.id;
  }
  if (!p.payerInn) return null;
  const same = open
    .filter((i) => i.inn === p.payerInn && i.amount === p.amount)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return same[0]?.id ?? null;
}
