"use server";

import type { DocumentKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-button";
import { db } from "@/lib/db";
import { DiadocError } from "@/lib/finance/diadoc";
import { importCounteragents, sendActToDiadoc } from "@/lib/finance/diadoc-service";
import { DocumentError, docTitle, getTochka, issueDocument, syncPayments } from "@/lib/finance/documents";
import { sendDocumentEmail, TochkaError } from "@/lib/finance/tochka";

function message(e: unknown) {
  if (e instanceof DocumentError || e instanceof DiadocError || e instanceof TochkaError) return e.message;
  console.error(e);
  return "Что-то пошло не так, попробуйте ещё раз";
}

function revalidateFinance(dealId?: string) {
  revalidatePath("/finance");
  revalidatePath("/integrations/tochka");
  revalidatePath("/deals");
  revalidatePath("/dashboard");
  if (dealId) revalidatePath(`/deals/${dealId}`);
}

export async function issueDocumentAction(dealId: string, kind: DocumentKind): Promise<ActionResult> {
  try {
    const doc = await issueDocument(dealId, kind);
    revalidateFinance(dealId);
    return { ok: `${docTitle(doc)} создан в Точке` };
  } catch (e) {
    return { error: message(e) };
  }
}

// Удаляет счёт или акт только из CRM: в Точке и Диадоке документ остаётся. Поступления по счёту сохраняются без привязки
export async function deleteDocumentAction(id: string) {
  const doc = await db.document.findUnique({ where: { id }, select: { dealId: true } });
  if (!doc) return;
  await db.document.delete({ where: { id } });
  revalidateFinance(doc.dealId);
}

export async function syncPaymentsAction(): Promise<ActionResult> {
  try {
    const r = await syncPayments(30);
    revalidateFinance();
    return { ok: `Новых поступлений: ${r.added}, оплачено счетов: ${r.paid}` };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function sendToDiadocAction(documentId: string): Promise<ActionResult> {
  try {
    const doc = await sendActToDiadoc(documentId);
    revalidateFinance(doc.dealId);
    return { ok: "Акт лежит в Диадоке в черновиках: подпишите и отправьте его там" };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function emailDocumentAction(documentId: string): Promise<ActionResult> {
  try {
    const [tochka, doc] = await Promise.all([
      getTochka(),
      db.document.findUnique({ where: { id: documentId }, include: { company: { select: { email: true } } } }),
    ]);
    if (!tochka) return { error: "Точка не подключена" };
    if (!doc?.tochkaId) return { error: "Документ не найден" };
    if (!doc.company.email) return { error: "У клиента не указан email" };
    await sendDocumentEmail(
      tochka.token,
      doc.kind === "INVOICE" ? "bills" : "closing-documents",
      tochka.account.customerCode,
      doc.tochkaId,
      doc.company.email,
    );
    return { ok: `Отправлено на ${doc.company.email}` };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function importClientsAction(): Promise<ActionResult> {
  try {
    const r = await importCounteragents();
    revalidatePath("/clients");
    revalidatePath("/integrations/diadoc");
    return { ok: `Контрагентов в Диадоке: ${r.total}. Новых клиентов: ${r.created}, дополнено: ${r.updated}` };
  } catch (e) {
    return { error: message(e) };
  }
}
