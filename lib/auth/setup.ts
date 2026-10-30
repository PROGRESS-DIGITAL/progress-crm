import { db } from "@/lib/db";
import { newTotpSecret } from "@/lib/auth/totp";

// Обычные функции для страниц входа. В app/login/actions.ts их держать нельзя:
// всё, что экспортирует файл "use server", можно вызвать из браузера без входа

// Ключ установки защищает первую настройку пароля директора на сервере: его печатает install.sh.
// На Маке ключа нет — пароль задаётся сразу
export function setupKey() {
  return process.env.SETUP_KEY || process.env.BASIC_AUTH_PASSWORD || "";
}

export async function setupNeeded() {
  const owner = await db.employee.findFirst({ where: { isOwner: true }, select: { passwordHash: true } });
  return !owner?.passwordHash;
}

// Первая настройка кода: секрет создаётся при открытии шага и включается, только когда приложение выдало верный код
export async function ensureTotpSecret(employeeId: string) {
  const e = await db.employee.findUniqueOrThrow({ where: { id: employeeId } });
  if (e.totpSecret && !e.totpEnabled) return e.totpSecret;
  const secret = newTotpSecret();
  await db.employee.update({ where: { id: employeeId }, data: { totpSecret: secret, totpEnabled: false } });
  return secret;
}
