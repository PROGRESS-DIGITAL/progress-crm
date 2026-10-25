import type { Incoming } from "./inbox";

// Telegram Bot API: https://core.telegram.org/bots/api
// Входящие забираем длинным опросом getUpdates, поэтому бот работает и с CRM на своём компьютере без публичного адреса
const API = process.env.TELEGRAM_API_URL ?? "https://api.telegram.org";
export const TELEGRAM_TOKEN_SETTING = "telegram.botToken";
export const TELEGRAM_OFFSET_SETTING = "telegram.offset";
export const TELEGRAM_BOT_SETTING = "telegram.botUsername";

export function isTelegramToken(value: string) {
  return /^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(value);
}

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };
type TgMessage = { message_id: number; date: number; chat: { id: number; type: string } & TgUser; from?: TgUser; text?: string; caption?: string };
export type TgUpdate = { update_id: number; message?: TgMessage };


// Берём только личные сообщения: группы и каналы в CRM не нужны
export function incomingFromUpdate(update: TgUpdate): Incoming | null {
  const m = update.message;
  if (!m || m.chat.type !== "private") return null;
  const text = m.text ?? m.caption ?? "[вложение без текста]";
  const who = m.from ?? m.chat;
  const name = [who.first_name, who.last_name].filter(Boolean).join(" ") || (who.username ? `@${who.username}` : "Без имени");
  return {
    externalId: String(m.chat.id),
    name,
    username: who.username ?? null,
    text,
    messageId: String(m.message_id),
    date: new Date(m.date * 1000),
  };
}

async function call<T>(token: string, method: string, body?: object, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal,
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!json?.ok) throw new Error(json?.description ?? `Telegram ответил ${res.status}`);
  return json.result as T;
}

export function getMe(token: string) {
  return call<{ username: string; first_name: string }>(token, "getMe");
}

// Если у бота был вебхук, getUpdates не работает; снимаем его при подключении
export function deleteWebhook(token: string) {
  return call<boolean>(token, "deleteWebhook");
}

export function getUpdates(token: string, offset: number, signal?: AbortSignal) {
  return call<TgUpdate[]>(token, "getUpdates", { offset, timeout: 25, allowed_updates: ["message"] }, signal);
}

export async function sendTelegram(token: string, chatId: string, text: string) {
  const m = await call<{ message_id: number }>(token, "sendMessage", { chat_id: chatId, text });
  return String(m.message_id);
}
