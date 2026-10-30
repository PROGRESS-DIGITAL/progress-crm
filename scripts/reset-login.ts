// Восстановление входа на сервере: временный пароль и сброс кода из приложения.
// Запуск: npx tsx scripts/reset-login.ts [логин]; без логина — директор
import { PrismaClient } from "@prisma/client";
import { hashPassword, tempPassword } from "../lib/auth/password";

const db = new PrismaClient();

async function main() {
  const login = process.argv[2]?.trim().toLowerCase();
  const employee = login ? await db.employee.findUnique({ where: { login } }) : await db.employee.findFirst({ where: { isOwner: true } });
  if (!employee) {
    console.error(login ? `Сотрудник с логином ${login} не найден` : "Директор ещё не создан: откройте CRM в браузере");
    process.exit(1);
  }
  if (!employee.passwordHash) {
    console.log("Пароль ещё не задан: откройте CRM в браузере и задайте его на странице входа");
    return;
  }
  const password = tempPassword();
  await db.$transaction([
    db.employee.update({
      where: { id: employee.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        totpEnabled: false,
        totpSecret: null,
        failedLogins: 0,
        lockedUntil: null,
        blocked: false,
      },
    }),
    db.session.deleteMany({ where: { employeeId: employee.id } }),
    db.trustedDevice.deleteMany({ where: { employeeId: employee.id } }),
  ]);
  console.log(`${employee.name}\n  Логин: ${employee.login}\n  Временный пароль: ${password}`);
  console.log("При входе CRM попросит придумать новый пароль и заново подключить приложение для кодов.");
}

main().finally(() => db.$disconnect());
