import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import type { MailAccount, MailFolder, MailProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { networkError } from "@/lib/net";
import { PROVIDERS, emailsOf, formatAddresses, htmlToText, makeSnippet, type Address } from "./core";

// При первом подключении забираем последние письма папки, а не весь архив за годы
const FIRST_SYNC = 200;

type Login = { provider: MailProvider; email: string; password: string };

function client(a: Login) {
  return new ImapFlow({
    host: PROVIDERS[a.provider].imap,
    port: 993,
    secure: true,
    auth: { user: a.email, pass: a.password },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 120_000,
  });
}

// Понятная причина вместо «Command failed»
export function mailError(e: unknown, provider: MailProvider) {
  const err = e as { authenticationFailed?: boolean; responseText?: string; message?: string };
  const text = `${err.responseText ?? ""} ${err.message ?? ""}`;
  // Яндекс на неверный пароль и на выключенный IMAP отвечает одной фразой, причину он не различает
  if (/invalid credentials or imap is disabled/i.test(text))
    return "Яндекс не пустил в ящик: так он отвечает и на неподходящий пароль, и на выключенный IMAP. Проверьте, что в почте включено «С сервера imap.yandex.ru по протоколу IMAP», а пароль приложения с типом «Почта» создан под этим же адресом (в Яндекс ID, где вы вошли как этот ящик) и вставлен целиком";
  if (/imap.*(disabled|выключен|отключен)/i.test(text))
    return `В настройках ${PROVIDERS[provider].label} выключен доступ по IMAP: включите его и попробуйте снова`;
  if (err.authenticationFailed || /AUTHENTICATIONFAILED|invalid credentials|authentication failed/i.test(text))
    return "Почта не приняла пароль. Нужен пароль приложения, а не обычный пароль от аккаунта";
  return networkError(e, PROVIDERS[provider].imap);
}

export async function withImap<T>(a: Login, fn: (c: ImapFlow) => Promise<T>) {
  const c = client(a);
  // Без обработчика обрыв соединения в фоне роняет сервер
  c.on("error", () => {});
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.logout().catch(() => c.close());
  }
}

// Путь папки на сервере. У Gmail «Отправленные» называются по-разному на разных языках, поэтому ищем по флагу
async function folderPath(c: ImapFlow, folder: MailFolder | "TRASH") {
  if (folder === "INBOX") return "INBOX";
  const flag = folder === "SENT" ? "\\Sent" : "\\Trash";
  return (await c.list()).find((m) => m.specialUse === flag)?.path ?? null;
}

const addresses = (a: AddressObject | AddressObject[] | undefined): Address[] =>
  (Array.isArray(a) ? a : a ? [a] : []).flatMap((x) => x.value);

// Message-ID без угловых скобок: nodemailer и mailparser пишут его по-разному
export const cleanMessageId = (id: string | null | undefined) => id?.trim().replace(/^<|>$/g, "") || null;

// Клиент по адресу: сначала контакты, потом email компании
export async function companyByEmails(emails: string[]) {
  if (!emails.length) return null;
  const OR = emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } }));
  const contact = await db.contact.findFirst({ where: { OR }, select: { companyId: true } });
  if (contact) return contact.companyId;
  return (await db.company.findFirst({ where: { OR }, select: { id: true } }))?.id ?? null;
}

async function saveMessage(account: MailAccount, folder: MailFolder, uid: number, seen: boolean, mail: ParsedMail) {
  const from = addresses(mail.from)[0] ?? {};
  const to = formatAddresses(addresses(mail.to));
  const cc = formatAddresses(addresses(mail.cc)) || null;
  const html = typeof mail.html === "string" ? mail.html : null;
  const text = mail.text?.trim() || (html ? htmlToText(html) : "");
  const messageId = cleanMessageId(mail.messageId);

  // Письмо, отправленное из CRM, уже есть без номера: только дописываем номер из «Отправленных»
  if (folder === "SENT" && messageId) {
    const local = await db.mailMessage.findFirst({ where: { accountId: account.id, folder, uid: null, messageId } });
    if (local) {
      await db.mailMessage.update({ where: { id: local.id }, data: { uid } });
      return;
    }
  }

  const counterpart = folder === "INBOX" ? emailsOf(from.address) : emailsOf(`${to}, ${cc ?? ""}`);
  const data = {
    messageId,
    inReplyTo: cleanMessageId(mail.inReplyTo),
    references: (Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : []).join(" ") || null,
    fromEmail: from.address ?? "",
    fromName: from.name || null,
    to,
    cc,
    subject: mail.subject?.trim() || "(без темы)",
    text,
    html,
    snippet: makeSnippet(text),
    date: mail.date ?? new Date(),
    seen,
    companyId: await companyByEmails(counterpart.filter((e) => e !== account.email.toLowerCase())),
  };
  const saved = await db.mailMessage.upsert({
    where: { accountId_folder_uid: { accountId: account.id, folder, uid } },
    update: {},
    create: {
      accountId: account.id,
      folder,
      uid,
      ...data,
      attachments: {
        create: mail.attachments.map((a) => ({
          name: a.filename || "вложение",
          mime: a.contentType || "application/octet-stream",
          size: a.size ?? a.content.length,
          cid: a.cid ?? null,
          data: new Uint8Array(a.content),
        })),
      },
    },
    include: { attachments: { select: { id: true, cid: true } } },
  });
  // Картинки внутри письма ссылаются на cid: подменяем на адрес вложения в CRM
  const inline = saved.attachments.filter((a) => a.cid);
  if (html && inline.length) {
    let fixed = html;
    for (const a of inline) fixed = fixed.split(`cid:${a.cid}`).join(`/mail/files/${a.id}`);
    await db.mailMessage.update({ where: { id: saved.id }, data: { html: fixed } });
  }
}

async function syncFolder(c: ImapFlow, account: MailAccount, folder: MailFolder) {
  const path = await folderPath(c, folder);
  if (!path) return;
  const lock = await c.getMailboxLock(path, { readOnly: true });
  try {
    const box = c.mailbox;
    if (!box) return;
    const validity = String(box.uidValidity);
    const [uidKey, validityKey] = folder === "INBOX" ? (["inboxUid", "inboxValidity"] as const) : (["sentUid", "sentValidity"] as const);
    let lastUid = account[uidKey];
    if (account[validityKey] !== validity) {
      // Сервер перенумеровал письма: старые номера больше ничего не значат, последние письма заберём заново
      if (account[validityKey]) await db.mailMessage.deleteMany({ where: { accountId: account.id, folder, uid: { not: null } } });
      lastUid = 0;
    }
    let maxUid = lastUid;
    if (box.exists) {
      const messages = lastUid
        ? c.fetch(`${lastUid + 1}:*`, { uid: true, flags: true, source: true }, { uid: true })
        : c.fetch(`${Math.max(1, box.exists - FIRST_SYNC + 1)}:*`, { uid: true, flags: true, source: true });
      for await (const m of messages) {
        // «N:*» по правилам IMAP возвращает последнее письмо, даже если оно старше N
        if (m.uid <= lastUid || !m.source) continue;
        maxUid = Math.max(maxUid, m.uid);
        await saveMessage(account, folder, m.uid, folder === "SENT" || !!m.flags?.has("\\Seen"), await simpleParser(m.source));
      }
    }
    await db.mailAccount.update({ where: { id: account.id }, data: { [uidKey]: maxUid, [validityKey]: validity } });
  } finally {
    lock.release();
  }
}

export async function syncAccount(account: MailAccount) {
  await withImap(account, async (c) => {
    await syncFolder(c, account, "INBOX");
    await syncFolder(c, account, "SENT");
  });
}

// Прочитано в CRM — прочитано и в почте
export async function markSeenOnServer(account: MailAccount, uid: number) {
  await withImap(account, async (c) => {
    const lock = await c.getMailboxLock("INBOX");
    try {
      await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  });
}

// Удалённое письмо уходит в корзину ящика, как при удалении в самой почте
export async function trashOnServer(account: MailAccount, folder: MailFolder, uid: number) {
  await withImap(account, async (c) => {
    const [path, trash] = [await folderPath(c, folder), await folderPath(c, "TRASH")];
    if (!path) return;
    const lock = await c.getMailboxLock(path);
    try {
      if (trash && trash !== path) await c.messageMove(String(uid), trash, { uid: true });
      else await c.messageDelete(String(uid), { uid: true });
    } finally {
      lock.release();
    }
  });
}
