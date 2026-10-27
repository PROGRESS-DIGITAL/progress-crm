import { db } from "@/lib/db";
import { mailError, syncAccount } from "./imap";

// Одна синхронизация за раз: фоновая и кнопка «Обновить» не забирают одни письма дважды
let running: Promise<void> | null = null;

export function syncAllMail() {
  running ??= (async () => {
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
      running = null;
    }
  })();
  return running;
}
