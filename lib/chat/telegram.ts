import { fetch as proxyFetch, ProxyAgent } from "undici";
import { getSetting } from "@/lib/settings";
import type { Incoming } from "./inbox";

// Telegram Bot API: https://core.telegram.org/bots/api
// Входящие забираем длинным опросом getUpdates, поэтому бот работает и с CRM на своём компьютере без публичного адреса
const API = process.env.TELEGRAM_API_URL ?? "https://api.telegram.org";
export const TELEGRAM_TOKEN_SETTING = "telegram.botToken";
export const TELEGRAM_OFFSET_SETTING = "telegram.offset";
export const TELEGRAM_BOT_SETTING = "telegram.botUsername";
// Прокси для api.telegram.org, если провайдер его не пропускает: http://адрес:порт.
// Без настройки берётся TELEGRAM_PROXY — его ставит start.command из системного прокси Мака
export const TELEGRAM_PROXY_SETTING = "telegram.proxy";

export function isProxyUrl(value: string) {
  return /^https?:\/\/([^\s:@/]+(:[^\s@/]*)?@)?[^\s:/]+:\d{2,5}\/?$/.test(value);
}

export async function telegramProxy() {
  return (await getSetting(TELEGRAM_PROXY_SETTING)) || process.env.TELEGRAM_PROXY || null;
}

const agents = new Map<string, ProxyAgent>();
function agentFor(proxy: string) {
  let agent = agents.get(proxy);
  if (!agent) agents.set(proxy, (agent = new ProxyAgent(proxy)));
  return agent;
}

// «fetch failed» ничего не говорит: достаём настоящую причину из error.cause
export function networkError(e: unknown, proxy?: string | null) {
  const cause = (e as { cause?: { code?: string } })?.cause;
  const code = cause?.code ?? (e as { code?: string })?.code;
  if (proxy && code !== "UND_ERR_ABORTED") {
    return `прокси ${proxy} не пропустил запрос${code ? ` (${code})` : ""}: проверьте, что VPN-клиент запущен и адрес верный`;
  }
  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "не найден адрес api.telegram.org: проверьте интернет";
    case "ETIMEDOUT":
    case "UND_ERR_CONNECT_TIMEOUT":
      return "api.telegram.org не отвечает, похоже, провайдер его блокирует: включите VPN или укажите прокси";
    case "ECONNRESET":
    case "ECONNREFUSED":
    case "UND_ERR_SOCKET":
      return "соединение с api.telegram.org сброшено, похоже, провайдер его блокирует: включите VPN или укажите прокси";
    case "UND_ERR_ABORTED":
      return "запрос прерван";
    default:
      if (e instanceof Error && e.message !== "fetch failed") return e.message;
      return `нет связи с api.telegram.org${code ? ` (${code})` : ""}: включите VPN или укажите прокси`;
  }
}

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

async function call<T>(token: string, method: string, body?: object, signal?: AbortSignal, proxy?: string | null): Promise<T> {
  const via = proxy === undefined ? await telegramProxy() : proxy;
  const init = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}), signal };
  let res: Response;
  try {
    res = via
      ? ((await proxyFetch(`${API}/bot${token}/${method}`, { ...init, dispatcher: agentFor(via) })) as unknown as Response)
      : await fetch(`${API}/bot${token}/${method}`, init);
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(networkError(e, via));
  }
  const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!json?.ok) throw new Error(json?.description ?? `Telegram ответил ${res.status}`);
  return json.result as T;
}

// proxy передаётся при подключении, чтобы проверить ещё не сохранённый прокси
export function getMe(token: string, proxy?: string | null) {
  return call<{ username: string; first_name: string }>(token, "getMe", undefined, undefined, proxy);
}

// Если у бота был вебхук, getUpdates не работает; снимаем его при подключении
export function deleteWebhook(token: string, proxy?: string | null) {
  return call<boolean>(token, "deleteWebhook", undefined, undefined, proxy);
}

export function getUpdates(token: string, offset: number, signal?: AbortSignal) {
  return call<TgUpdate[]>(token, "getUpdates", { offset, timeout: 25, allowed_updates: ["message"] }, signal);
}

export async function sendTelegram(token: string, chatId: string, text: string) {
  const m = await call<{ message_id: number }>(token, "sendMessage", { chat_id: chatId, text });
  return String(m.message_id);
}
