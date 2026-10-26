import type { Incoming } from "./inbox";
import { netFetch } from "@/lib/net";

// Max Bot API: https://dev.max.ru/docs-api
// Как и в Telegram, входящие забираем длинным опросом GET /updates, публичный адрес CRM не нужен
const API = process.env.MAX_API_URL ?? "https://platform-api2.max.ru";
export const MAX_TOKEN_SETTING = "max.botToken";
export const MAX_MARKER_SETTING = "max.marker";
export const MAX_BOT_SETTING = "max.botName";

type MaxUser = { user_id: number; first_name?: string; last_name?: string | null; name?: string; username?: string | null };
export type MaxUpdate = {
  update_type: string;
  timestamp: number;
  message?: {
    sender?: MaxUser;
    recipient?: { chat_id?: number; chat_type?: string; user_id?: number };
    timestamp: number;
    body?: { mid: string; text?: string | null; attachments?: unknown[] | null } | null;
  };
};

// Берём только личные диалоги с ботом
export function incomingFromMax(u: MaxUpdate): Incoming | null {
  const m = u.message;
  if (u.update_type !== "message_created" || !m?.sender || m.recipient?.chat_type !== "dialog") return null;
  const s = m.sender;
  const name = [s.first_name, s.last_name].filter(Boolean).join(" ") || s.name || (s.username ? `@${s.username}` : "Без имени");
  return {
    externalId: String(s.user_id),
    name,
    username: s.username ?? null,
    text: m.body?.text || "[вложение без текста]",
    messageId: m.body?.mid ?? `${s.user_id}:${m.timestamp}`,
    date: new Date(m.timestamp),
  };
}

async function call<T>(token: string, path: string, init?: { method?: string; body?: object; signal?: AbortSignal }) {
  const res = await netFetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: token, "content-type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: init?.signal,
  });
  const json = (await res.json().catch(() => null)) as (T & { message?: string; code?: string }) | null;
  if (!res.ok || !json) throw new Error(json?.message ?? `Max ответил ${res.status}`);
  return json as T;
}

export function getMaxBot(token: string) {
  return call<{ user_id: number; name?: string; first_name?: string; username?: string | null }>(token, "/me");
}

export function getMaxUpdates(token: string, marker: number | null, signal?: AbortSignal) {
  const q = new URLSearchParams({ timeout: "25", types: "message_created" });
  if (marker !== null) q.set("marker", String(marker));
  return call<{ updates: MaxUpdate[]; marker: number | null }>(token, `/updates?${q}`, { signal });
}

export async function sendMax(token: string, userId: string, text: string) {
  const r = await call<{ message?: { body?: { mid?: string } } }>(token, `/messages?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
    body: { text },
  });
  return r.message?.body?.mid ?? `out:${Date.now()}`;
}
