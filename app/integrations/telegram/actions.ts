"use server";

import { revalidatePath } from "next/cache";
import type { TokenState } from "@/components/token-form";
import { deleteSettings, setSetting } from "@/lib/settings";
import {
  deleteWebhook,
  getMe,
  isTelegramToken,
  TELEGRAM_BOT_SETTING,
  TELEGRAM_OFFSET_SETTING,
  TELEGRAM_TOKEN_SETTING,
} from "@/lib/chat/telegram";

function revalidate() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/telegram");
  revalidatePath("/chats");
}

export async function saveTelegramToken(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!isTelegramToken(token)) return { error: "Токен выглядит как 123456789:AAE… — скопируйте его из @BotFather целиком" };
  let bot: string;
  try {
    bot = (await getMe(token)).username;
    await deleteWebhook(token);
  } catch (e) {
    return { error: `Telegram не принял токен: ${e instanceof Error ? e.message : "ошибка"}` };
  }
  await setSetting(TELEGRAM_TOKEN_SETTING, token);
  await setSetting(TELEGRAM_BOT_SETTING, bot);
  await deleteSettings(TELEGRAM_OFFSET_SETTING);
  revalidate();
  return { ok: `Бот @${bot} подключён` };
}

export async function deleteTelegramToken() {
  await deleteSettings(TELEGRAM_TOKEN_SETTING, TELEGRAM_BOT_SETTING, TELEGRAM_OFFSET_SETTING);
  revalidate();
}
