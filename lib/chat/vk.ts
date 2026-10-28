import type { Incoming } from "./inbox";
import { netFetch } from "@/lib/net";

// Сообщения сообщества ВКонтакте через Bots Long Poll API: https://dev.vk.com/ru/api/bots-long-poll/getting-started
const API = process.env.VK_API_URL ?? "https://api.vk.com/method";
const VERSION = "5.199";
export const VK_TOKEN_SETTING = "vk.groupToken";
export const VK_GROUP_SETTING = "vk.group"; // JSON: { id, name, screenName }

export type VkGroup = { id: number; name: string; screenName: string };
type VkMessage = { id: number; date: number; peer_id: number; from_id: number; text?: string; attachments?: unknown[] };
export type VkUpdate = { type: string; object?: { message?: VkMessage } };
type VkUser = { id: number; first_name?: string; last_name?: string; screen_name?: string };

// Личное сообщение сообществу: peer_id совпадает с id человека; беседы (peer_id > 2e9) пропускаем
export function incomingFromVk(u: VkUpdate, users: Map<number, VkUser>): Incoming | null {
  const m = u.object?.message;
  if (u.type !== "message_new" || !m || m.peer_id >= 2_000_000_000 || m.from_id <= 0) return null;
  const user = users.get(m.from_id);
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || `id${m.from_id}`;
  return {
    externalId: String(m.peer_id),
    name,
    username: user?.screen_name ?? null,
    text: m.text || "[вложение без текста]",
    messageId: String(m.id),
    date: new Date(m.date * 1000),
  };
}

export async function vkCall<T>(token: string, method: string, params: Record<string, string | number> = {}) {
  const body = new URLSearchParams({ access_token: token, v: VERSION });
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  const res = await netFetch(`${API}/${method}`, { method: "POST", body });
  const json = (await res.json().catch(() => null)) as { response?: T; error?: { error_msg?: string } } | null;
  if (!json || json.error || json.response === undefined) throw new Error(json?.error?.error_msg ?? `VK ответил ${res.status}`);
  return json.response;
}

// Ключ сообщества знает своё сообщество: groups.getById без параметров возвращает его
export async function getVkGroup(token: string): Promise<VkGroup> {
  const r = await vkCall<{ groups?: { id: number; name: string; screen_name: string }[] } | { id: number; name: string; screen_name: string }[]>(
    token,
    "groups.getById",
  );
  const g = Array.isArray(r) ? r[0] : r.groups?.[0];
  if (!g) throw new Error("Ключ не относится к сообществу");
  return { id: g.id, name: g.name, screenName: g.screen_name };
}

type Server = { key: string; server: string; ts: string };

export function getVkLongPollServer(token: string, groupId: number) {
  return vkCall<Server>(token, "groups.getLongPollServer", { group_id: groupId });
}

// Один запрос к серверу Long Poll; failed: 1 — сдвинуть ts, 2 и 3 — получить сервер заново
export async function vkCheck(server: Server, signal?: AbortSignal) {
  const q = new URLSearchParams({ act: "a_check", key: server.key, ts: server.ts, wait: "25" });
  const res = await netFetch(`${server.server}?${q}`, { signal });
  return (await res.json()) as { ts?: string; updates?: VkUpdate[]; failed?: number };
}

export async function getVkUsers(token: string, ids: number[]) {
  if (!ids.length) return new Map<number, VkUser>();
  const users = await vkCall<VkUser[]>(token, "users.get", { user_ids: ids.join(","), fields: "screen_name" });
  return new Map(users.map((u) => [u.id, u]));
}

export async function sendVk(token: string, peerId: string, text: string) {
  const id = await vkCall<number>(token, "messages.send", {
    peer_id: peerId,
    message: text,
    random_id: Math.floor(Math.random() * 2_147_483_647),
  });
  return String(id);
}

// «Печатает…» у собеседника: VK показывает его около 10 секунд или до нашего сообщения
export async function sendVkTyping(token: string, peerId: string) {
  await vkCall<number>(token, "messages.setActivity", { peer_id: peerId, type: "typing" });
}
