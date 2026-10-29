"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { MAX_FILE_SIZE, fileSize } from "@/lib/tasks";
import { MAIL_MAX_TOTAL, parseAddresses } from "@/lib/mail/core";
import { cleanMessageId, companyByEmails, trashOnServer } from "@/lib/mail/imap";
import { sendViaSmtp, smtpError } from "@/lib/mail/send";
import { syncAllMail } from "@/lib/mail/sync";
import { makeSnippet } from "@/lib/mail/core";

// Кнопка «Обновить» ждёт почту не дольше 15 секунд: большой ящик докачается в фоне, а страница
// обновляется сама. Иначе, пока идёт долгая загрузка, браузер держит в очереди и «Отправить»
export async function refreshMail() {
  await Promise.race([syncAllMail().catch(() => {}), new Promise((ok) => setTimeout(ok, 15_000))]);
  revalidatePath("/mail");
}

export async function deleteMail(id: string, back: string) {
  const m = await db.mailMessage.findUnique({ where: { id }, include: { account: true } });
  if (!m) return;
  if (m.uid !== null) {
    try {
      await trashOnServer(m.account, m.folder, m.uid);
    } catch {
      // Почта недоступна: письмо всё равно убираем из CRM, в ящике оно останется
    }
  }
  await db.mailMessage.delete({ where: { id } });
  revalidatePath("/mail");
  redirect(back);
}

export type SendState = { error?: string } | undefined;

export async function sendMail(_prev: SendState, formData: FormData): Promise<SendState> {
  const account = await db.mailAccount.findUnique({ where: { id: String(formData.get("accountId") ?? "") } });
  if (!account) return { error: "Выберите ящик, с которого отправить" };
  const to = parseAddresses(String(formData.get("to") ?? ""));
  const cc = parseAddresses(String(formData.get("cc") ?? ""));
  const wrong = [...to.invalid, ...cc.invalid];
  if (wrong.length) return { error: `Проверьте адрес: ${wrong.join(", ")}` };
  if (!to.valid.length) return { error: "Укажите, кому отправить" };
  const subject = String(formData.get("subject") ?? "").trim() || "(без темы)";
  const text = String(formData.get("text") ?? "");

  // Новые файлы и вложения пересылаемого письма, которые оставили отмеченными
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const big = files.find((f) => f.size > MAX_FILE_SIZE);
  if (big) return { error: `Файл «${big.name}» больше ${fileSize(MAX_FILE_SIZE)}` };
  const keepIds = formData.getAll("keep").map(String);
  const kept = keepIds.length ? await db.mailAttachment.findMany({ where: { id: { in: keepIds } } }) : [];
  const attachments = [
    ...kept.map((a) => ({ filename: a.name, content: Buffer.from(a.data), contentType: a.mime })),
    ...(await Promise.all(
      files.map(async (f) => ({ filename: f.name, content: Buffer.from(await f.arrayBuffer()), contentType: f.type || "application/octet-stream" })),
    )),
  ];
  const total = attachments.reduce((sum, a) => sum + a.content.length, 0);
  if (total > MAIL_MAX_TOTAL) return { error: `Вместе файлы весят ${fileSize(total)}, а в одно письмо помещается до ${fileSize(MAIL_MAX_TOTAL)}` };

  // Ответ продолжает переписку: почтовые программы клиента покажут его в той же цепочке
  const original = formData.get("replyTo") ? await db.mailMessage.findUnique({ where: { id: String(formData.get("replyTo")) } }) : null;
  const inReplyTo = original?.messageId ?? null;
  const references = original ? [original.references, original.messageId && `<${original.messageId}>`].filter(Boolean).join(" ") : null;

  let messageId: string;
  try {
    messageId = await sendViaSmtp(account, { to: to.valid, cc: cc.valid, subject, text, inReplyTo, references, attachments });
  } catch (e) {
    return { error: `Письмо не ушло: ${smtpError(e, account.provider)}` };
  }

  // Копия в «Отправленных» CRM сразу; при синхронизации к ней допишется номер из ящика
  const saved = await db.mailMessage.create({
    data: {
      accountId: account.id,
      folder: "SENT",
      messageId: cleanMessageId(messageId),
      inReplyTo,
      references,
      fromEmail: account.email,
      fromName: account.name,
      to: to.valid.join(", "),
      cc: cc.valid.join(", ") || null,
      subject,
      text,
      snippet: makeSnippet(text),
      date: new Date(),
      seen: true,
      companyId: await companyByEmails([...to.valid, ...cc.valid].map((e) => e.toLowerCase())),
      attachments: {
        create: attachments.map((a) => ({ name: a.filename, mime: a.contentType, size: a.content.length, data: new Uint8Array(a.content) })),
      },
    },
  });
  revalidatePath("/mail");
  if (saved.companyId) revalidatePath(`/clients/${saved.companyId}`);
  redirect(`/mail?f=sent&m=${saved.id}`);
}
