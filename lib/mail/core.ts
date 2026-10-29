import type { MailProvider } from "@prisma/client";

// Почтовые сервисы: адреса серверов и где взять пароль приложения.
// Обычный пароль от аккаунта по IMAP не пускают ни Google, ни Яндекс
export const PROVIDERS: Record<
  MailProvider,
  { label: string; imap: string; smtp: string; passwordUrl: string; passwordHint: string }
> = {
  GMAIL: {
    label: "Gmail",
    imap: "imap.gmail.com",
    smtp: "smtp.gmail.com",
    passwordUrl: "https://myaccount.google.com/apppasswords",
    passwordHint: "Пароль приложения из аккаунта Google: 16 букв, работает только при включённой двухэтапной проверке",
  },
  YANDEX: {
    label: "Яндекс Почта",
    imap: "imap.yandex.ru",
    smtp: "smtp.yandex.ru",
    passwordUrl: "https://id.yandex.ru/security/app-passwords",
    passwordHint: "Пароль приложения из Яндекс ID с типом «Почта»",
  },
};

// Почту на своём домене (Google Workspace, Яндекс 360) по адресу не узнать: тогда сервис выбирают сами
export function detectProvider(email: string): MailProvider | null {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (["gmail.com", "googlemail.com"].includes(domain)) return "GMAIL";
  if (["yandex.ru", "ya.ru", "yandex.com", "yandex.by", "yandex.kz", "narod.ru"].includes(domain)) return "YANDEX";
  return null;
}

// Все вложения письма вместе: в пути они вырастают на треть, а Яндекс и Gmail принимают письма до 25–30 МБ
export const MAIL_MAX_TOTAL = 20 * 1024 * 1024;

export type Address = { name?: string | null; address?: string | null };

// Список адресатов строкой, как в заголовке письма: «Иван <ivan@a.ru>, b@c.ru»
export function formatAddresses(list: Address[]) {
  return list
    .filter((a) => a.address)
    .map((a) => (a.name && a.name !== a.address ? `${a.name} <${a.address}>` : a.address!))
    .join(", ");
}

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

// Адреса из поля «Кому»: через запятую или точку с запятой, можно с именем «Иван <ivan@a.ru>».
// Неверные возвращаются отдельно, чтобы показать их в ошибке
export function parseAddresses(input: string) {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of input.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
    const email = (part.match(/<([^>]+)>/)?.[1] ?? part).trim();
    (EMAIL.test(email) ? valid : invalid).push(email);
  }
  return { valid, invalid };
}

// Только адреса из строки получателей, в нижнем регистре: по ним ищем клиента
export function emailsOf(header: string | null | undefined) {
  return parseAddresses(header ?? "").valid.map((e) => e.toLowerCase());
}

export function makeSnippet(text: string) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}

// Текст из HTML, если у письма нет текстовой версии
export function htmlToText(html: string) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// «Re: Тема» без «Re: Re: Re:»
export function replySubject(subject: string) {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

export function forwardSubject(subject: string) {
  return /^(fwd?|пересл\.?):/i.test(subject.trim()) ? subject.trim() : `Fwd: ${subject.trim()}`;
}

const quoteDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

// Подпись встаёт под место для текста, над цитатой; «-- » почтовые программы узнают как начало подписи
export function withSignature(text: string, signature: string | null | undefined) {
  if (!signature?.trim()) return text;
  return `\n\n-- \n${signature.trim()}${text ? `\n\n${text.replace(/^\n+/, "")}` : ""}`;
}

// Цитата исходного письма под ответом, как в почтовых программах
export function quoteText(text: string, from: string, date: Date) {
  const quoted = text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  return `\n\n${quoteDate.format(date)}, ${from}:\n${quoted}`;
}

export function forwardText(m: { text: string; from: string; to: string; subject: string; date: Date }) {
  return `\n\n---------- Пересланное письмо ----------\nОт: ${m.from}\nДата: ${quoteDate.format(m.date)}\nТема: ${m.subject}\nКому: ${m.to}\n\n${m.text}`;
}
