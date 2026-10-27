import nodemailer from "nodemailer";
import type { MailProvider } from "@prisma/client";
import { networkError } from "@/lib/net";
import { PROVIDERS } from "./core";

type Login = { provider: MailProvider; email: string; password: string; name?: string | null };

function transport(a: Login) {
  return nodemailer.createTransport({
    host: PROVIDERS[a.provider].smtp,
    port: 465,
    secure: true,
    auth: { user: a.email, pass: a.password },
    connectionTimeout: 20_000,
  });
}

export function smtpError(e: unknown, provider: MailProvider) {
  const err = e as { code?: string; responseCode?: number; response?: string };
  if (err.code === "EAUTH" || err.responseCode === 535)
    return "Почта не приняла пароль при отправке. Нужен пароль приложения, а не обычный пароль от аккаунта";
  if (err.responseCode && err.response) return `Сервер почты отказал: ${err.response}`;
  return networkError(e, PROVIDERS[provider].smtp);
}

export async function verifySmtp(a: Login) {
  await transport(a).verify();
}

export async function sendViaSmtp(
  a: Login,
  mail: {
    to: string[];
    cc: string[];
    subject: string;
    text: string;
    inReplyTo?: string | null;
    references?: string | null;
    attachments: { filename: string; content: Buffer; contentType: string }[];
  },
) {
  const info = await transport(a).sendMail({
    from: a.name ? { name: a.name, address: a.email } : a.email,
    to: mail.to,
    cc: mail.cc.length ? mail.cc : undefined,
    subject: mail.subject,
    text: mail.text,
    inReplyTo: mail.inReplyTo ? `<${mail.inReplyTo}>` : undefined,
    references: mail.references || undefined,
    attachments: mail.attachments,
  });
  return info.messageId;
}
