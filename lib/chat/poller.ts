import { receiveIncoming } from "./inbox";
import { getMaxUpdates, incomingFromMax, MAX_MARKER_SETTING, MAX_TOKEN_SETTING } from "./max";
import { getSetting, setSetting } from "./settings";
import { getUpdates, incomingFromUpdate, TELEGRAM_OFFSET_SETTING, TELEGRAM_TOKEN_SETTING } from "./telegram";
import { getVkLongPollServer, getVkUsers, incomingFromVk, VK_GROUP_SETTING, VK_TOKEN_SETTING, vkCheck, type VkGroup } from "./vk";

const IDLE_MS = 5_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Один шаг опроса: false — мессенджер не подключён, подождать и проверить снова
type Poll = () => Promise<boolean>;

// Telegram: забрать новые сообщения и сдвинуть offset, чтобы не получить их снова
export async function pollTelegramOnce() {
  const token = await getSetting(TELEGRAM_TOKEN_SETTING);
  if (!token) return false;
  let offset = Number(await getSetting(TELEGRAM_OFFSET_SETTING)) || 0;
  const updates = await getUpdates(token, offset);
  for (const u of updates) {
    const m = incomingFromUpdate(u);
    if (m) await receiveIncoming("TELEGRAM", m);
    offset = u.update_id + 1;
  }
  if (updates.length) await setSetting(TELEGRAM_OFFSET_SETTING, String(offset));
  return true;
}

export async function pollMaxOnce() {
  const token = await getSetting(MAX_TOKEN_SETTING);
  if (!token) return false;
  const saved = await getSetting(MAX_MARKER_SETTING);
  const r = await getMaxUpdates(token, saved ? Number(saved) : null);
  for (const u of r.updates) {
    const m = incomingFromMax(u);
    if (m) await receiveIncoming("MAX", m);
  }
  if (r.marker !== null && String(r.marker) !== saved) await setSetting(MAX_MARKER_SETTING, String(r.marker));
  return true;
}

// VK выдаёт адрес сервера Long Poll с ключом; держим его в памяти и получаем заново, когда ключ устарел
let vkServer: { token: string; key: string; server: string; ts: string } | null = null;

export async function pollVkOnce() {
  const [token, groupJson] = await Promise.all([getSetting(VK_TOKEN_SETTING), getSetting(VK_GROUP_SETTING)]);
  if (!token || !groupJson) return false;
  const group = JSON.parse(groupJson) as VkGroup;
  if (!vkServer || vkServer.token !== token) vkServer = { token, ...(await getVkLongPollServer(token, group.id)) };
  const r = await vkCheck(vkServer);
  if (r.failed) {
    if (r.failed === 1 && r.ts) vkServer.ts = r.ts;
    else vkServer = null;
    return true;
  }
  if (r.ts) vkServer.ts = r.ts;
  const updates = r.updates ?? [];
  const ids = [...new Set(updates.map((u) => u.object?.message?.from_id).filter((id): id is number => !!id && id > 0))];
  const users = await getVkUsers(token, ids);
  for (const u of updates) {
    const m = incomingFromVk(u, users);
    if (m) await receiveIncoming("VK", m);
  }
  return true;
}

function loop(name: string, poll: Poll) {
  void (async () => {
    for (;;) {
      try {
        if (!(await poll())) await sleep(IDLE_MS);
      } catch (e) {
        console.error(`${name}:`, e instanceof Error ? e.message : e);
        await sleep(IDLE_MS);
      }
    }
  })();
}

// Запускается один раз при старте сервера (instrumentation.ts) и крутится, пока работает CRM
export function startPolling() {
  const g = globalThis as { __chatPolling?: boolean };
  if (g.__chatPolling) return;
  g.__chatPolling = true;
  loop("Telegram", pollTelegramOnce);
  loop("Max", pollMaxOnce);
  loop("VK", pollVkOnce);
}
