"use server";

import { revalidatePath } from "next/cache";
import { deleteSettings, getSetting, setSetting } from "@/lib/settings";
import { describeError } from "@/lib/agents/agent";
import {
  YANDEX_DEFAULT_MODEL,
  YANDEX_FOLDER_SETTING,
  YANDEX_KEY_SETTING,
  YANDEX_MODEL_SETTING,
  yandexComplete,
} from "@/lib/agents/yandex";

export type YandexState = { error?: string; check?: string; ok?: boolean } | undefined;

function revalidate() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/yandex");
  revalidatePath("/agents", "layout");
  revalidatePath("/chats");
}

// Ключ, каталог и модель сохраняются, а потом проверяются коротким запросом: так видно, отвечает ли YandexGPT
export async function saveYandex(_prev: YandexState, formData: FormData): Promise<YandexState> {
  const key = String(formData.get("apiKey") ?? "").trim();
  const folderId = String(formData.get("folderId") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim() || YANDEX_DEFAULT_MODEL;
  const current = await getSetting(YANDEX_KEY_SETTING);
  if (!key && !current) return { error: "Вставьте API-ключ" };
  if (key && (key.length < 20 || /\s/.test(key))) return { error: "Это не похоже на API-ключ: он длинный и без пробелов" };
  if (!/^[a-z0-9]{10,40}$/i.test(folderId)) return { error: "Идентификатор каталога — строка из латинских букв и цифр, например b1g…" };
  if (!/^(gpt:\/\/)?[a-z0-9][a-z0-9._/@-]*$/i.test(model)) return { error: "Название модели без пробелов, например yandexgpt-5-lite" };

  if (key) await setSetting(YANDEX_KEY_SETTING, key);
  await setSetting(YANDEX_FOLDER_SETTING, folderId);
  if (model === YANDEX_DEFAULT_MODEL) await deleteSettings(YANDEX_MODEL_SETTING);
  else await setSetting(YANDEX_MODEL_SETTING, model);
  revalidate();

  try {
    const alt = await yandexComplete(
      { apiKey: key || current!, folderId, model },
      { messages: [{ role: "user", content: "Ответь одним словом: работает?" }], maxTokens: 20 },
      20_000,
    );
    return alt?.message?.content?.trim()
      ? { ok: true, check: "Сохранено, YandexGPT отвечает." }
      : { ok: false, check: "Сохранено, но YandexGPT вернул пустой ответ." };
  } catch (e) {
    return { ok: false, check: `Сохранено, но проверка не прошла: ${describeError(e)}` };
  }
}

export async function deleteYandex() {
  await deleteSettings(YANDEX_KEY_SETTING, YANDEX_FOLDER_SETTING, YANDEX_MODEL_SETTING);
  revalidate();
}
