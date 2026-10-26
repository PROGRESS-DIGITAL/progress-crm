"use server";

import { revalidatePath } from "next/cache";
import type { TokenState } from "@/components/token-form";
import { getMaxBot, MAX_BOT_SETTING, MAX_MARKER_SETTING, MAX_TOKEN_SETTING } from "@/lib/chat/max";
import { deleteSettings, setSetting } from "@/lib/settings";

function revalidate() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/max");
  revalidatePath("/chats");
}

export async function saveMaxToken(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const token = String(formData.get("token") ?? "").trim();
  if (token.length < 20 || /\s/.test(token)) return { error: "Вставьте токен бота из кабинета Max для партнёров целиком" };
  let bot: string;
  try {
    const me = await getMaxBot(token);
    bot = me.username ? `@${me.username}` : (me.name ?? me.first_name ?? "бот");
  } catch (e) {
    return { error: `Max не принял токен: ${e instanceof Error ? e.message : "ошибка"}` };
  }
  await setSetting(MAX_TOKEN_SETTING, token);
  await setSetting(MAX_BOT_SETTING, bot);
  await deleteSettings(MAX_MARKER_SETTING);
  revalidate();
  return { ok: `Бот ${bot} подключён` };
}

export async function deleteMaxToken() {
  await deleteSettings(MAX_TOKEN_SETTING, MAX_BOT_SETTING, MAX_MARKER_SETTING);
  revalidate();
}
