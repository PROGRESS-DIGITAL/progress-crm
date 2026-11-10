"use server";

import type { DocumentKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-button";
import { db } from "@/lib/db";
import { DiadocError } from "@/lib/finance/diadoc";
import { importCounteragents, sendActToDiadoc } from "@/lib/finance/diadoc-service";
import { DocumentError, docTitle, getTochka, issueDocument, syncPayments } from "@/lib/finance/documents";
import { SberError } from "@/lib/finance/sber";
import { getSber, importStatementFile, syncSber } from "@/lib/finance/sber-service";
import { StatementError } from "@/lib/finance/statement-1c";
import { sendDocumentEmail, TochkaError } from "@/lib/finance/tochka";
import { trashDocument } from "@/lib/trash";

function message(e: unknown) {
  if (e instanceof DocumentError || e instanceof DiadocError || e instanceof TochkaError || e instanceof SberError || e instanceof StatementError)
    return e.message;
  console.error(e);
  return "Что-то пошло не так, попробуйте ещё раз";
}

function revalidateFinance(dealId?: string) {
  revalidatePath("/finance");
  revalidatePath("/integrations/tochka");
  revalidatePath("/integrations/sber");
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
  await trashDocument(id);
  revalidateFinance(doc.dealId);
}

// Обновить оплаты из всех подключённых банков: ошибка одного банка не мешает другому
export async function syncPaymentsAction(): Promise<ActionResult> {
  const [tochka, sber] = await Promise.all([getTochka(), getSber()]);
  let added = 0;
  let paid = 0;
  const errors: string[] = [];
  const banks: [string, () => Promise<{ added: number; paid: number }>][] = [];
  if (tochka) banks.push(["Точка", () => syncPayments(30)]);
  if (sber) banks.push(["Сбер", () => syncSber(30)]);
  for (const [name, run] of banks) {
    try {
      const r = await run();
      added += r.added;
      paid += r.paid;
    } catch (e) {
      errors.push(`${name}: ${message(e)}`);
    }
  }
  revalidateFinance();
  const summary = `Новых поступлений: ${added}, оплачено счетов: ${paid}`;
  if (errors.length) return { error: banks.length > errors.length ? `${summary}. ${errors.join("; ")}` : errors.join("; ") };
  return { ok: summary };
}

// Выписка в формате 1С из интернет-банка: Сбер без API или любой другой банк
export async function importStatementAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Выберите файл выписки" };
  try {
    const r = await importStatementFile(new Uint8Array(await file.arrayBuffer()));
    revalidateFinance();
    const skipped = r.tochkaSkipped ? `. Поступления на счёт в Точке пропущены: они приходят по API` : "";
    return { ok: `Поступлений в файле: ${r.total}, новых: ${r.added}, оплачено счетов: ${r.paid}${skipped}` };
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
