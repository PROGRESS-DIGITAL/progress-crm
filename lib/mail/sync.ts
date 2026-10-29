import { db } from "@/lib/db";
import { mailError, syncAccount } from "./imap";

// Одна синхронизация за раз: фоновая и кнопка «Обновить» не забирают одни письма дважды.
// Замок лежит в globalThis: фоновые задачи и страницы сервер может собрать в разные модули
const g = globalThis as { __mailSync?: Promise<void> | null };

export const mailSyncing = () => !!g.__mailSync;

export function syncAllMail() {
  g.__mailSync ??= (async () => {
    try {
      for (const account of await db.mailAccount.findMany()) {
        try {
          await syncAccount(account);
          await db.mailAccount.update({ where: { id: account.id }, data: { syncedAt: new Date(), lastError: null } });
        } catch (e) {
          await db.mailAccount.update({ where: { id: account.id }, data: { lastError: mailError(e, account.provider) } });
        }
      }
    } finally {
      g.__mailSync = null;
    }
  })();
  return g.__mailSync;
}
