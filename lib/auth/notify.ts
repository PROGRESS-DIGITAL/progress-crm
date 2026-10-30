import { getSetting } from "@/lib/settings";
import { sendTelegram, TELEGRAM_TOKEN_SETTING } from "@/lib/chat/telegram";
import { getRemindChat } from "@/lib/reminders";

// Сообщение директору в Telegram — в тот же чат, куда приходят напоминания.
// Не настроен бот или чат — молча пропускаем: вход не должен ломаться из-за уведомления
export async function notifyOwner(text: string) {
  try {
    const [token, chat] = await Promise.all([getSetting(TELEGRAM_TOKEN_SETTING), getRemindChat()]);
    if (!token || !chat) return false;
    await sendTelegram(token, chat.chatId, text);
    return true;
  } catch (e) {
    console.error("Не удалось отправить уведомление о входе", e);
    return false;
  }
}

export async function ownerTelegramReady() {
  const [token, chat] = await Promise.all([getSetting(TELEGRAM_TOKEN_SETTING), getRemindChat()]);
  return !!token && !!chat;
}
