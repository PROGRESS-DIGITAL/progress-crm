// Защита от перебора с одного адреса: не больше 20 неудачных попыток за 15 минут.
// Счётчик в памяти процесса: после перезапуска обнуляется, а блокировка по логину хранится в базе
const WINDOW_MS = 15 * 60_000;
const MAX_PER_IP = 20;

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60_000;

const g = globalThis as unknown as { __loginFails?: Map<string, number[]> };
const fails = (g.__loginFails ??= new Map<string, number[]>());

function recent(ip: string, now: number) {
  const list = (fails.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  fails.set(ip, list);
  return list;
}

export function ipBlocked(ip: string | null, now = Date.now()) {
  return !!ip && recent(ip, now).length >= MAX_PER_IP;
}

export function ipFailed(ip: string | null, now = Date.now()) {
  if (ip) recent(ip, now).push(now);
}
