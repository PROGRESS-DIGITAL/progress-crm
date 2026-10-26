"use server";

import { revalidatePath } from "next/cache";
import type { TokenState } from "@/components/token-form";
import { deleteSettings, setSetting } from "@/lib/settings";
import { getVkGroup, getVkLongPollServer, VK_GROUP_SETTING, VK_TOKEN_SETTING } from "@/lib/chat/vk";

function revalidate() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/vk");
  revalidatePath("/chats");
}

export async function saveVkToken(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!/^vk1\.a\.[A-Za-z0-9_-]{20,}$/.test(token) && !/^[0-9a-f]{85}$/.test(token)) {
    return { error: "Ключ сообщества начинается с vk1.a. — скопируйте его в «Управление → Работа с API» целиком" };
  }
  try {
    const group = await getVkGroup(token);
    // Проверяем и права, и что Long Poll включён: без него сообщения не придут
    await getVkLongPollServer(token, group.id);
    await setSetting(VK_TOKEN_SETTING, token);
    await setSetting(VK_GROUP_SETTING, JSON.stringify(group));
    revalidate();
    return { ok: `Сообщество «${group.name}» подключено` };
  } catch (e) {
    return { error: `VK не принял ключ: ${e instanceof Error ? e.message : "ошибка"}` };
  }
}

export async function deleteVkToken() {
  await deleteSettings(VK_TOKEN_SETTING, VK_GROUP_SETTING);
  revalidate();
}
