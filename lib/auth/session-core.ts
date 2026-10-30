import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth/tokens";
import { SECTIONS, isSection } from "@/lib/auth/sections";

// Общая часть сессий без next/headers: её вызывает и proxy.ts, и страницы
export const SESSION_COOKIE = "crm_session";
export const DEVICE_COOKIE = "crm_device";
export const PENDING_MS = 10 * 60_000;
export const SESSION_MS = 7 * 86_400_000;
export const DEVICE_MS = 30 * 86_400_000;
const TOUCH_MS = 5 * 60_000;

export type AuthUser = {
  id: string;
  name: string;
  login: string | null;
  isOwner: boolean;
  position: string | null;
  avatar: string | null;
  roleName: string | null;
  sections: string[];
};

const ALL = SECTIONS.map((s) => s.key as string);

// Сессия по токену из cookie. Просроченная, удалённая или у заблокированного сотрудника — null.
// touch продлевает вход тому, кто работает: не чаще раза в 5 минут, чтобы не писать в базу на каждый запрос
export async function sessionByToken(token: string | undefined, touch = false) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { employee: { include: { role: true } } },
  });
  const now = Date.now();
  if (!session || session.expiresAt.getTime() < now || session.employee.blocked) return null;
  if (touch && session.verified && now - session.lastSeenAt.getTime() > TOUCH_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_MS) } })
      .catch(() => {});
  }
  const e = session.employee;
  const user: AuthUser = {
    id: e.id,
    name: e.name,
    login: e.login,
    isOwner: e.isOwner,
    position: e.position,
    avatar: e.avatar,
    roleName: e.isOwner ? "Директор" : (e.role?.name ?? null),
    sections: e.isOwner ? ALL : (e.role?.sections.filter(isSection) ?? []),
  };
  return { session, employee: e, user };
}

// Куда вести после входа: первый открытый раздел или личные данные, если разделов нет
export function homeFor(user: Pick<AuthUser, "sections">) {
  const first = SECTIONS.find((s) => user.sections.includes(s.key));
  return first ? `/${first.key}` : "/profile";
}
