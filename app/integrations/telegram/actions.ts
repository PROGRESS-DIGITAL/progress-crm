"use server";

import { revalidatePath } from "next/cache";
import type { TokenState } from "@/components/token-form";
import { deleteSettings, getSetting, setSetting } from "@/lib/settings";
import { getRemindChat, REMIND_CHAT_SETTING } from "@/lib/reminders";
import { sendTelegram } from "@/lib/chat/telegram";
import {
  deleteWebhook,
  getMe,
  isProxyUrl,
  isTelegramToken,
  TELEGRAM_BOT_SETTING,
  TELEGRAM_OFFSET_SETTING,
  TELEGRAM_PROXY_SETTING,
  TELEGRAM_TOKEN_SETTING,
} from "@/lib/chat/telegram";

function revalidate() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/telegram");
  revalidatePath("/chats");
}

export async function saveTelegramToken(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const typed = String(formData.get("token") ?? "").trim();
  const proxy = String(formData.get("proxy") ?? "").trim() || null;
  // Токен уже сохранён — можно поменять только прокси, не вводя токен заново
  const token = typed || (await getSetting(TELEGRAM_TOKEN_SETTING));
  if (!token || !isTelegramToken(token)) {
    return { error: "Токен выглядит как 123456789:AAE… — скопируйте его из @BotFather целиком" };
  }
  if (proxy && !isProxyUrl(proxy)) return { error: "Прокси укажите как http://адрес:порт, например http://127.0.0.1:1087" };
  const via = proxy ?? process.env.TELEGRAM_PROXY ?? null;
  let bot: string;
  try {
    bot = (await getMe(token, via)).username;
    await deleteWebhook(token, via);
  } catch (e) {
    return { error: `Не получилось подключить бота: ${e instanceof Error ? e.message : "ошибка"}` };
  }
  if (proxy) await setSetting(TELEGRAM_PROXY_SETTING, proxy);
  else await deleteSettings(TELEGRAM_PROXY_SETTING);
  // Другой бот не может писать в чат, привязанный к прежнему: напоминания нужно привязать заново
  if ((await getSetting(TELEGRAM_BOT_SETTING)) !== bot) await deleteSettings(REMIND_CHAT_SETTING);
  if (typed) {
    await setSetting(TELEGRAM_TOKEN_SETTING, token);
    await setSetting(TELEGRAM_BOT_SETTING, bot);
    await deleteSettings(TELEGRAM_OFFSET_SETTING);
  }
  revalidate();
  return { ok: `Бот @${bot} подключён${via ? " через прокси" : ""}` };
}

export async function deleteTelegramToken() {
  await deleteSettings(TELEGRAM_TOKEN_SETTING, TELEGRAM_BOT_SETTING, TELEGRAM_OFFSET_SETTING, REMIND_CHAT_SETTING);
  revalidate();
}

export async function sendTestReminder(): Promise<{ error?: string; ok?: string }> {
  const [token, chat] = await Promise.all([getSetting(TELEGRAM_TOKEN_SETTING), getRemindChat()]);
  if (!token || !chat) return { error: "Сначала привяжите Telegram для напоминаний" };
  try {
    await sendTelegram(token, chat.chatId, "⏰ Проверка: так будут выглядеть напоминания из календаря CRM.");
  } catch (e) {
    return { error: `Telegram не доставил сообщение: ${e instanceof Error ? e.message : "ошибка"}` };
  }
  return { ok: "Отправил, проверьте Telegram" };
}

export async function unlinkReminders() {
  await deleteSettings(REMIND_CHAT_SETTING);
  revalidate();
}
