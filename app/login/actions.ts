"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { verifyTotp } from "@/lib/auth/totp";
import { setupKey, setupNeeded } from "@/lib/auth/setup";
import { sha256, sixDigits } from "@/lib/auth/tokens";
import { ipBlocked, ipFailed, LOCK_MS, MAX_FAILED_LOGINS } from "@/lib/auth/limits";
import { notifyOwner, ownerTelegramReady } from "@/lib/auth/notify";
import {
  clientMeta,
  currentSession,
  deviceLabel,
  deviceTrusted,
  dropAllSessions,
  endSession,
  homeFor,
  startSession,
  trustDevice,
  verifySession,
} from "@/lib/auth/session";

export type LoginState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

const CODE_MS = 5 * 60_000;
const CODE_TRIES = 5;
const RESEND_MS = 60_000;

// Адрес, куда вернуться после входа: только внутренний путь, чтобы ссылкой нельзя было увести на чужой сайт
function safeNext(raw: FormDataEntryValue | null) {
  const v = typeof raw === "string" ? raw : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") ? v : "";
}

const normLogin = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function journal(employeeId: string | null, login: string, ok: boolean, reason: string) {
  const meta = await clientMeta();
  await db.loginEvent.create({ data: { employeeId, login: login.slice(0, 100), ok, reason, ...meta } });
}

export async function setupOwner(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const values = { name: text(formData.get("name")), login: text(formData.get("login")) };
  if (!(await setupNeeded())) return { error: "Директор уже задал пароль. Войдите своим логином." };
  const key = setupKey();
  if (key && text(formData.get("setupKey")).trim() !== key) {
    const { ip } = await clientMeta();
    ipFailed(ip);
    return { error: "Неверный ключ установки. Он напечатан в конце установки на сервере.", values };
  }
  const name = values.name.trim();
  const login = normLogin(formData.get("login"));
  const password = text(formData.get("password"));
  if (!name) return { error: "Укажите имя", values };
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) return { error: "Логин: латинские буквы, цифры, точка или дефис, от 3 символов", values };
  const problem = passwordProblem(password);
  if (problem) return { error: problem, values };
  if (password !== text(formData.get("password2"))) return { error: "Пароли не совпадают", values };

  const owner =
    (await db.employee.findFirst({ where: { isOwner: true } })) ?? (await db.employee.create({ data: { name, isOwner: true } }));
  await db.employee.update({
    where: { id: owner.id },
    data: { name, login, passwordHash: await hashPassword(password), mustChangePassword: false, totpEnabled: false, totpSecret: null },
  });
  await journal(owner.id, login, true, "Пароль директора задан");
  await startSession(owner.id, false);
  redirect("/login/code");
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const login = normLogin(formData.get("login"));
  const password = text(formData.get("password"));
  const next = safeNext(formData.get("next"));
  const values = { login: text(formData.get("login")) };
  const { ip, userAgent } = await clientMeta();
  if (!login || !password) return { error: "Введите логин и пароль", values };
  if (ipBlocked(ip)) {
    await journal(null, login, false, "Слишком много попыток с этого адреса");
    return { error: "Слишком много попыток. Подождите 15 минут.", values };
  }

  const employee = await db.employee.findUnique({ where: { login } });
  // Сравниваем пароль и для несуществующего логина, чтобы по времени ответа нельзя было подобрать логины
  const ok = await verifyPassword(password, employee?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  const now = Date.now();

  if (employee?.lockedUntil && employee.lockedUntil.getTime() > now) {
    await journal(employee.id, login, false, "Вход заблокирован после неверных паролей");
    const min = Math.ceil((employee.lockedUntil.getTime() - now) / 60_000);
    return { error: `Слишком много неверных паролей. Вход закрыт ещё на ${min} мин.`, values };
  }
  if (!employee || !ok) {
    ipFailed(ip);
    if (employee) {
      const failed = employee.failedLogins + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await db.employee.update({
        where: { id: employee.id },
        data: { failedLogins: lock ? 0 : failed, ...(lock && { lockedUntil: new Date(now + LOCK_MS) }) },
      });
      await journal(employee.id, login, false, lock ? "Неверный пароль, вход закрыт на 15 минут" : "Неверный пароль");
      if (lock) {
        await notifyOwner(
          `⚠️ PROGRESS CRM: ${MAX_FAILED_LOGINS} неверных паролей подряд для «${employee.name}» (логин ${login}). ` +
            `Вход закрыт на 15 минут.\nАдрес: ${ip ?? "неизвестен"}, ${deviceLabel(userAgent)}`,
        );
        return { error: "Слишком много неверных паролей. Вход закрыт на 15 минут.", values };
      }
    } else {
      await journal(null, login, false, "Неизвестный логин");
    }
    return { error: "Неверный логин или пароль", values };
  }
  if (employee.blocked) {
    await journal(employee.id, login, false, "Сотрудник заблокирован");
    return { error: "Вход для этой учётной записи закрыт. Обратитесь к директору.", values };
  }

  await db.employee.update({ where: { id: employee.id }, data: { failedLogins: 0, lockedUntil: null } });
  // Доверенное устройство пропускает второй шаг, но не смену временного пароля и не первую настройку кода
  if (employee.totpEnabled && !employee.mustChangePassword && (await deviceTrusted(employee.id))) {
    await startSession(employee.id, true);
    await journal(employee.id, login, true, "Вход с доверенного устройства");
    redirect(next || "/");
  }
  await startSession(employee.id, false);
  redirect(next ? `/login/code?next=${encodeURIComponent(next)}` : "/login/code");
}

// Ожидающий второго шага вход; без него шаги кода не открываются
async function pending() {
  const s = await currentSession();
  if (!s || s.session.verified) return null;
  return s;
}

async function finish(s: NonNullable<Awaited<ReturnType<typeof pending>>>, how: string, formData: FormData): Promise<never> {
  const { userAgent, ip } = await clientMeta();
  const label = deviceLabel(userAgent);
  const trusted = await deviceTrusted(s.employee.id);
  await verifySession(s.session.id);
  if (formData.get("remember") === "on" && !trusted) await trustDevice(s.employee.id, label);
  await journal(s.employee.id, s.employee.login ?? "", true, how);
  if (!trusted) {
    await notifyOwner(
      `🔐 Вход в PROGRESS CRM: ${s.employee.name}${s.employee.isOwner ? "" : ` (${s.user.roleName ?? "без роли"})`}\n` +
        `${label}, адрес ${ip ?? "неизвестен"}\nЕсли это были не вы — смените пароль в «Личных данных».`,
    );
  }
  redirect(safeNext(formData.get("next")) || homeFor(s.user));
}

export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const s = await pending();
  if (!s) redirect("/login");
  const code = text(formData.get("code")).replace(/\D/g, "");
  if (code.length !== 6) return { error: "Введите 6 цифр" };

  const e = s.employee;
  if (e.totpSecret && e.totpEnabled && verifyTotp(e.totpSecret, code)) return finish(s, "Код из приложения", formData);

  const { codeHash, codeExpires, codeTries } = s.session;
  if (codeHash && codeExpires && codeExpires.getTime() > Date.now() && codeTries < CODE_TRIES) {
    if (sha256(code) === codeHash) return finish(s, "Код из Telegram", formData);
    await db.session.update({ where: { id: s.session.id }, data: { codeTries: { increment: 1 } } });
  }
  const { ip } = await clientMeta();
  ipFailed(ip);
  await journal(e.id, e.login ?? "", false, "Неверный код второго шага");
  // Перебор кода: после пяти ошибок вход начинается заново с пароля
  const fails = await db.loginEvent.count({
    where: { employeeId: e.id, ok: false, reason: "Неверный код второго шага", createdAt: { gt: s.session.createdAt } },
  });
  if (fails >= CODE_TRIES) {
    await endSession();
    redirect("/login?error=code");
  }
  return { error: "Код не подошёл. Проверьте, что часы на телефоне идут точно." };
}

export async function sendTelegramCode(_prev: LoginState): Promise<LoginState> {
  const s = await pending();
  if (!s) redirect("/login");
  if (!s.employee.isOwner || !(await ownerTelegramReady())) return { error: "Запасной код в Telegram доступен только директору" };
  const sentAt = s.session.codeExpires ? s.session.codeExpires.getTime() - CODE_MS : 0;
  if (Date.now() - sentAt < RESEND_MS) return { error: "Код уже отправлен. Новый можно запросить через минуту." };
  const code = sixDigits();
  const sent = await notifyOwner(`Код для входа в PROGRESS CRM: ${code}\nДействует 5 минут. Никому его не сообщайте.`);
  if (!sent) return { error: "Не удалось отправить код в Telegram. Используйте код из приложения." };
  await db.session.update({
    where: { id: s.session.id },
    data: { codeHash: sha256(code), codeExpires: new Date(Date.now() + CODE_MS), codeTries: 0 },
  });
  return { ok: "Код отправлен в Telegram. Он действует 5 минут." };
}

export async function confirmTotp(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const s = await pending();
  if (!s) redirect("/login");
  const e = await db.employee.findUniqueOrThrow({ where: { id: s.employee.id } });
  if (e.totpEnabled) redirect("/login/code");
  if (!e.totpSecret || !verifyTotp(e.totpSecret, text(formData.get("code")))) {
    return { error: "Код не подошёл. Отсканируйте QR-код ещё раз и введите 6 цифр из приложения." };
  }
  await db.employee.update({ where: { id: e.id }, data: { totpEnabled: true } });
  return finish(s, "Код из приложения настроен", formData);
}

export async function setNewPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const s = await pending();
  if (!s) redirect("/login");
  const password = text(formData.get("password"));
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== text(formData.get("password2"))) return { error: "Пароли не совпадают" };
  if (await verifyPassword(password, s.employee.passwordHash)) return { error: "Новый пароль должен отличаться от временного" };
  await db.employee.update({
    where: { id: s.employee.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false },
  });
  const next = safeNext(formData.get("next"));
  redirect(next ? `/login/code?next=${encodeURIComponent(next)}` : "/login/code");
}

export async function cancelLogin() {
  await endSession();
  redirect("/login");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}

// Выйти везде: закрыть все входы и забыть доверенные устройства, в том числе это
export async function signOutEverywhere() {
  const s = await currentSession();
  if (s) await dropAllSessions(s.employee.id);
  await endSession();
  redirect("/login");
}
