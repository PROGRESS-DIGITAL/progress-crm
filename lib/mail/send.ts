import nodemailer from "nodemailer";
import type { MailProvider } from "@prisma/client";
import { networkError, onServer, serviceHint } from "@/lib/net";
import { PROVIDERS } from "./core";

type Login = { provider: MailProvider; email: string; password: string; name?: string | null };

// Докуда дошла отправка: по нему понятно, где сервер замолчал и могло ли письмо уже уйти.
// Сами строки протокола не храним: в них пароль и текст письма
type Stage = "connect" | "auth" | "envelope" | "data" | "sent";

export function stageTracker() {
  const state = { stage: "connect" as Stage };
  const debug = (meta: { tnx?: string } | undefined, msg: unknown) => {
    const text = typeof msg === "string" ? msg : "";
    if (meta?.tnx === "smtp" && text.startsWith("SMTP handshake finished")) state.stage = "auth";
    else if (meta?.tnx === "send") state.stage = "envelope";
    else if (meta?.tnx === "server" && text.startsWith("354")) state.stage = "data";
    else if (meta?.tnx === "message" && text.includes("bytes encoded mime message")) state.stage = "sent";
  };
  const skip = () => {};
  return { state, logger: { trace: skip, debug, info: debug, warn: skip, error: skip, fatal: skip } };
}

const SMTP_PORT = 465;

function transport(a: Login, logger?: ReturnType<typeof stageTracker>["logger"]) {
  return nodemailer.createTransport({
    host: PROVIDERS[a.provider].smtp,
    port: SMTP_PORT,
    secure: true,
    auth: { user: a.email, pass: a.password },
    // Без этих ограничений nodemailer ждёт зависший сервер до 10 минут, и кнопка «Отправить» висит.
    // Письмо с файлами Яндекс может проверять дольше минуты, поэтому тишину в соединении терпим 3 минуты
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 180_000,
    ...(logger && { logger, debug: true }),
  });
}

// Сбой до рукопожатия SMTP: письмо точно не начинали передавать, поэтому повторить безопасно
export function isConnectFailure(err: { code?: string; stage?: Stage }) {
  return ["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNRESET"].includes(err.code ?? "") && (!err.stage || err.stage === "connect");
}

export function smtpError(e: unknown, provider: MailProvider) {
  const err = e as { code?: string; responseCode?: number; response?: string; timeoutType?: string; stage?: Stage };
  if (err.code === "EAUTH" || err.responseCode === 535)
    return "Почта не приняла пароль при отправке. Нужен пароль приложения, а не обычный пароль от аккаунта";
  if (err.responseCode && err.response) return `Сервер почты отказал: ${err.response}`;
  const host = PROVIDERS[provider].smtp;
  // Соединение уже было, сервер замолчал посреди отправки: сеть и VPN тут ни при чём
  if (err.code === "ETIMEDOUT" && err.timeoutType === "SOCKET_TIMEOUT" && err.stage === "sent")
    return `${host} принял письмо целиком, но не ответил за 3 минуты. Оно могло уйти: проверьте «Отправленные» в самом ящике, прежде чем отправлять ещё раз`;
  if (err.code === "ETIMEDOUT" && err.timeoutType === "SOCKET_TIMEOUT" && err.stage && err.stage !== "connect")
    return `${host} перестал отвечать посреди отправки и не ответил за 3 минуты. Попробуйте ещё раз чуть позже`;
  // До сервера почты не достучались (sendViaSmtp уже попробовал дважды). Порты на сервере открыты: другие письма
  // уходят, так что это сбой связи с почтой, а не настройка. Если не уйдёт ни одно, виноват может быть закрытый порт
  if (onServer() && isConnectFailure(err))
    return `сервер CRM дважды не смог связаться с ${host} (порт ${SMTP_PORT}). Письмо отправляет сервер, а не ваш браузер, поэтому VPN на компьютере тут ни при чём. Обычно это временный сбой связи с почтой: письмо не ушло, отправьте его ещё раз через минуту. Если не уходит ни одно письмо, попросите хостинг проверить, открыт ли исходящий порт ${SMTP_PORT}`;
  if (err.code === "ETIMEDOUT") return `${host} не отвечает, ${serviceHint()}`;
  if (err.code === "ECONNECTION" || err.code === "ESOCKET") return `соединение с ${host} оборвалось, ${serviceHint()}`;
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
    bcc?: string[];
    subject: string;
    text: string;
    html?: string | null;
    inReplyTo?: string | null;
    references?: string | null;
    attachments: { filename: string; content: Buffer; contentType: string }[];
  },
) {
  const started = Date.now();
  const size = mail.attachments.reduce((sum, f) => sum + f.content.length, 0);
  const attempt = async (n: number) => {
    const tracker = stageTracker();
    return transport(a, tracker.logger)
      .sendMail({
        from: a.name ? { name: a.name, address: a.email } : a.email,
        to: mail.to,
        cc: mail.cc.length ? mail.cc : undefined,
        bcc: mail.bcc?.length ? mail.bcc : undefined,
        subject: mail.subject,
        text: mail.text,
        html: mail.html || undefined,
        inReplyTo: mail.inReplyTo ? `<${mail.inReplyTo}>` : undefined,
        references: mail.references || undefined,
        attachments: mail.attachments,
      })
      .catch((e) => {
        const err = e as { code?: string; timeoutType?: string; responseCode?: number; stage?: Stage };
        err.stage = tracker.state.stage;
        // В журнал сервера: где замолчал сервер, сколько ждали и сколько весили файлы. Без адресов и текста
        console.error("[mail] send failed", {
          provider: a.provider,
          attempt: n,
          code: err.code,
          timeoutType: err.timeoutType,
          responseCode: err.responseCode,
          stage: err.stage,
          seconds: Math.round((Date.now() - started) / 1000),
          files: mail.attachments.length,
          bytes: size,
        });
        throw e;
      });
  };
  // Связь с почтой иногда не устанавливается с первого раза, хотя через минуту письмо уходит.
  // Если оборвалось ещё до рукопожатия, письмо точно не ушло, и вторая попытка не создаст дубль
  const info = await attempt(1).catch(async (e) => {
    if (!isConnectFailure(e)) throw e;
    await new Promise((r) => setTimeout(r, 2_000));
    return attempt(2);
  });
  return info.messageId;
}
