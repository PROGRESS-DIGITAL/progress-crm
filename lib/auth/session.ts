import { cache } from "react";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { newToken, sha256 } from "@/lib/auth/tokens";
import { DEVICE_COOKIE, DEVICE_MS, PENDING_MS, SESSION_COOKIE, SESSION_MS, sessionByToken } from "@/lib/auth/session-core";

export { homeFor, type AuthUser } from "@/lib/auth/session-core";

// IP и браузер для журнала входов. За Caddy настоящий адрес приходит в X-Forwarded-For
export async function clientMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

// На сервере с HTTPS cookie уходят только по защищённому соединению; на Маке CRM открывается по http://localhost
async function secure() {
  return (await headers()).get("x-forwarded-proto") === "https";
}

async function setCookie(name: string, value: string, maxAgeMs: number) {
  (await cookies()).set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secure(),
    path: "/",
    maxAge: Math.round(maxAgeMs / 1000),
  });
}

// Текущий вход: и подтверждённый, и ожидающий кода второго шага
export const currentSession = cache(async () => sessionByToken((await cookies()).get(SESSION_COOKIE)?.value));

// Сотрудник, полностью прошедший вход. proxy.ts не пускает без него ни на одну страницу, кроме /login
export const currentUser = cache(async () => {
  const s = await currentSession();
  return s?.session.verified ? s.user : null;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Нужно войти в CRM");
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  if (!user.isOwner) throw new Error("Это может только директор");
  return user;
}

// Имя для поля «ответственный» и автора сообщений: кто сейчас работает в CRM.
// Вне запроса (бот, напоминания) cookies недоступны — тогда владелец
export async function actorName() {
  try {
    const user = await currentUser();
    if (user) return user.name;
  } catch {}
  const owner = await db.employee.findFirst({ where: { isOwner: true }, select: { name: true } });
  return owner?.name ?? "Владелец CRM";
}

export async function startSession(employeeId: string, verified: boolean) {
  const token = newToken();
  const meta = await clientMeta();
  const ttl = verified ? SESSION_MS : PENDING_MS;
  await db.session.create({
    data: { tokenHash: sha256(token), employeeId, verified, ...meta, expiresAt: new Date(Date.now() + ttl) },
  });
  // cookie живёт дольше сессии: срок решает запись в базе, а cookie просто носит токен
  await setCookie(SESSION_COOKIE, token, 30 * 86_400_000);
}

export async function verifySession(sessionId: string) {
  await db.session.update({
    where: { id: sessionId },
    data: { verified: true, codeHash: null, codeExpires: null, codeTries: 0, lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_MS) },
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function trustDevice(employeeId: string, label: string | null) {
  const token = newToken();
  await db.trustedDevice.create({
    data: { tokenHash: sha256(token), employeeId, label, expiresAt: new Date(Date.now() + DEVICE_MS) },
  });
  await setCookie(DEVICE_COOKIE, token, DEVICE_MS);
}

export async function deviceTrusted(employeeId: string) {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return false;
  const device = await db.trustedDevice.findUnique({ where: { tokenHash: sha256(token) } });
  return !!device && device.employeeId === employeeId && device.expiresAt.getTime() > Date.now();
}

// Сбросить все входы сотрудника: при смене пароля, блокировке, «Выйти на всех устройствах»
export async function dropAllSessions(employeeId: string, keepSessionId?: string) {
  await db.$transaction([
    db.session.deleteMany({ where: { employeeId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) } }),
    db.trustedDevice.deleteMany({ where: { employeeId } }),
  ]);
}

// «Chrome на Mac», «Safari на iPhone»: понятная подпись устройства для уведомления и журнала
export function deviceLabel(ua: string | null) {
  if (!ua) return "неизвестное устройство";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  const browser = /YaBrowser/.test(ua)
    ? "Яндекс Браузер"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "браузер";
  return os ? `${browser} на ${os}` : browser;
}
