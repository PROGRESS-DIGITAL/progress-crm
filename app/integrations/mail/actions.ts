"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MailProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { detectProvider, parseAddresses, PROVIDERS } from "@/lib/mail/core";
import { mailError, withImap } from "@/lib/mail/imap";
import { smtpError, verifySmtp } from "@/lib/mail/send";
import { syncAllMail } from "@/lib/mail/sync";

export type MailboxState = { error?: string; values?: Record<string, string> } | undefined;

function revalidateMail() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/mail");
  revalidatePath("/mail");
}

// Подключение ящика: сначала проверяем вход по IMAP и SMTP, сохраняем только рабочий
export async function connectMailbox(_prev: MailboxState, formData: FormData): Promise<MailboxState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").replace(/\s+/g, "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const chosen = String(formData.get("provider") ?? "");
  const values = { email, name: name ?? "", provider: chosen };

  if (parseAddresses(email).valid.length !== 1) return { error: "Укажите адрес почты, например studio@yandex.ru", values };
  const provider = (chosen in PROVIDERS ? chosen : detectProvider(email)) as MailProvider | null;
  if (!provider) return { error: "Выберите, где почта: Gmail или Яндекс", values };
  if (!password) return { error: "Вставьте пароль приложения", values };
  if (await db.mailAccount.findUnique({ where: { email } })) return { error: "Этот ящик уже подключён", values };

  const login = { provider, email, password, name };
  try {
    await withImap(login, async () => {});
  } catch (e) {
    return { error: `Не удалось войти в почту: ${mailError(e, provider)}`, values };
  }
  try {
    await verifySmtp(login);
  } catch (e) {
    return { error: `Вход есть, но отправка не работает: ${smtpError(e, provider)}`, values };
  }

  await db.mailAccount.create({ data: login });
  // Первые письма забираются в фоне: в большом ящике это занимает время
  void syncAllMail();
  revalidateMail();
  redirect("/mail");
}

export async function disconnectMailbox(id: string) {
  await db.mailAccount.delete({ where: { id } });
  revalidateMail();
}

// Имя отправителя и подпись можно поменять у подключённого ящика, не подключая его заново
export async function updateMailbox(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || null;
  const signature = String(formData.get("signature") ?? "").replace(/\s+$/, "") || null;
  await db.mailAccount.update({ where: { id }, data: { name, signature } });
  revalidateMail();
}
