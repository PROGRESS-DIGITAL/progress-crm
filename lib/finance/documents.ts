import type { DocumentKind } from "@prisma/client";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { matchInvoice } from "./matching";
import {
  createAct,
  createInvoice,
  getStatement,
  incomingPayments,
  invoicePaymentStatus,
  isNdsKind,
  TOCHKA_ACCOUNT_SETTING,
  TOCHKA_NDS_SETTING,
  TOCHKA_TOKEN_SETTING,
  TochkaError,
  type NdsKind,
  type TochkaAccount,
} from "./tochka";

export const KIND_LABELS: Record<DocumentKind, string> = { INVOICE: "Счёт", ACT: "Акт" };

const moscowDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });

export function docTitle(d: { kind: DocumentKind; seq: number; date: Date }) {
  return `${KIND_LABELS[d.kind]} № ${d.seq} от ${d.date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}`;
}

export async function getTochka() {
  const [token, accountJson, nds] = await Promise.all([
    getSetting(TOCHKA_TOKEN_SETTING),
    getSetting(TOCHKA_ACCOUNT_SETTING),
    getSetting(TOCHKA_NDS_SETTING),
  ]);
  if (!token || !accountJson) return null;
  return { token, account: JSON.parse(accountJson) as TochkaAccount, nds: (isNdsKind(nds) ? nds : "without_nds") as NdsKind };
}

// Следующий номер в году; уникальный индекс не даст двум документам получить один номер
async function nextSeq(kind: DocumentKind, year: number) {
  const last = await db.document.findFirst({ where: { kind, year }, orderBy: { seq: "desc" }, select: { seq: true } });
  return (last?.seq ?? 0) + 1;
}

export class DocumentError extends Error {}

async function dealWithCompany(dealId: string) {
  const deal = await db.deal.findUnique({ where: { id: dealId }, include: { company: true, product: { select: { name: true } } } });
  if (!deal) throw new DocumentError("Сделка не найдена");
  const inn = deal.company.inn?.trim();
  if (!inn || !/^\d{10}(\d{2})?$/.test(inn)) {
    throw new DocumentError("У клиента не указан ИНН: заполните реквизиты в карточке клиента");
  }
  if (deal.amount <= 0) throw new DocumentError("Укажите сумму сделки");
  return { deal, party: { inn, kpp: deal.company.kpp, name: deal.company.name, address: deal.company.address } };
}

export async function issueDocument(dealId: string, kind: DocumentKind) {
  const tochka = await getTochka();
  if (!tochka) throw new DocumentError("Точка не подключена: подключите её в «Интеграциях»");
  const { deal, party } = await dealWithCompany(dealId);
  const invoice =
    kind === "ACT"
      ? await db.document.findFirst({ where: { dealId, kind: "INVOICE" }, orderBy: { createdAt: "desc" } })
      : null;

  const now = new Date();
  const year = Number(moscowDate(now).slice(0, 4));
  const title = deal.product?.name ?? deal.title;
  // Сначала занимаем номер в CRM, потом создаём документ в банке; если банк отказал — номер освобождаем
  const doc = await db.document.create({
    data: {
      kind,
      year,
      seq: await nextSeq(kind, year),
      date: now,
      amount: deal.amount,
      title,
      dealId,
      companyId: deal.companyId,
      invoiceId: invoice?.id,
    },
  });
  try {
    const input = { account: tochka.account, party, number: String(doc.seq), date: moscowDate(now), title, amount: deal.amount, nds: tochka.nds };
    const tochkaId =
      kind === "INVOICE"
        ? await createInvoice(tochka.token, input)
        : await createAct(tochka.token, input, invoice?.tochkaId);
    return await db.document.update({ where: { id: doc.id }, data: { tochkaId } });
  } catch (e) {
    await db.document.delete({ where: { id: doc.id } });
    if (e instanceof TochkaError) throw new DocumentError(`Точка не приняла документ: ${e.message}`);
    throw e;
  }
}

// Счёт оплачен: сделку переносим в «Оплачен», дата оплаты попадает в выручку месяца
export async function markPaid(documentId: string, paidAt: Date) {
  const doc = await db.document.update({
    where: { id: documentId },
    data: { status: "PAID", paidAt },
    include: { deal: { include: { stage: true } } },
  });
  if (doc.deal.stage.kind === "OPEN") {
    const won = await db.stage.findFirst({ where: { kind: "WON" }, orderBy: { order: "asc" } });
    if (won) await db.deal.update({ where: { id: doc.dealId }, data: { stageId: won.id, closedAt: paidAt } });
  }
  return doc;
}

async function openInvoices() {
  const docs = await db.document.findMany({
    where: { kind: "INVOICE", status: { not: "PAID" } },
    include: { company: { select: { inn: true } } },
  });
  return docs.map((d) => ({ id: d.id, seq: d.seq, amount: d.amount, inn: d.company.inn, date: d.date, tochkaId: d.tochkaId }));
}

// Подтянуть поступления за последние дни и разнести их по счетам
export async function syncPayments(days = 30) {
  const tochka = await getTochka();
  if (!tochka) return { added: 0, paid: 0 };
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const transactions = await getStatement(tochka.token, tochka.account.accountId, moscowDate(from), moscowDate(to));
  let added = 0;
  let paid = 0;
  for (const p of incomingPayments(transactions)) {
    const exists = await db.bankPayment.findUnique({ where: { transactionId: p.transactionId } });
    if (exists) continue;
    const invoiceId = matchInvoice(p, await openInvoices());
    await db.bankPayment.create({ data: { ...p, documentId: invoiceId } });
    added++;
    if (invoiceId) {
      await markPaid(invoiceId, p.date);
      paid++;
    }
  }

  // Счёт могли оплатить по ссылке или QR: спрашиваем статус у самой Точки
  for (const inv of await openInvoices()) {
    if (!inv.tochkaId) continue;
    try {
      const status = await invoicePaymentStatus(tochka.token, tochka.account.customerCode, inv.tochkaId);
      if (status === "payment_paid") {
        await markPaid(inv.id, new Date());
        paid++;
      } else if (status === "payment_expired") {
        await db.document.update({ where: { id: inv.id }, data: { status: "EXPIRED" } });
      }
    } catch {
      // Один недоступный счёт не мешает остальным
    }
  }
  return { added, paid };
}
