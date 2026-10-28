"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { deleteSettings, getSetting, setSetting } from "@/lib/settings";
import { CLAUDE_KEY_SETTING, CLAUDE_MODEL, CLAUDE_URL_SETTING, DEFAULT_BASE_URL, describeError } from "@/lib/agents/agent";

export type ClaudeState = { error?: string; check?: string; ok?: boolean } | undefined;

// Ключ и адрес API сохраняются, а потом проверяются запросом модели: так видно, дошёл ли запрос до Claude
export async function saveClaude(_prev: ClaudeState, formData: FormData): Promise<ClaudeState> {
  const key = String(formData.get("apiKey") ?? "").trim();
  const url = String(formData.get("baseUrl") ?? "").trim().replace(/\/+$/, "");
  const current = await getSetting(CLAUDE_KEY_SETTING);
  if (!key && !current) return { error: "Вставьте ключ API" };
  if (key && (key.length < 20 || /\s/.test(key))) return { error: "Это не похоже на ключ API: он длинный и без пробелов" };
  // http разрешён только для посредника на этом же компьютере
  if (url && !/^(https:\/\/[^\s/]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/.test(url))
    return { error: "Адрес должен начинаться с https://" };

  if (key) await setSetting(CLAUDE_KEY_SETTING, key);
  if (url && url !== DEFAULT_BASE_URL) await setSetting(CLAUDE_URL_SETTING, url);
  else await deleteSettings(CLAUDE_URL_SETTING);
  revalidatePath("/integrations");
  revalidatePath("/integrations/claude");
  revalidatePath("/agents", "layout");

  try {
    const client = new Anthropic({ apiKey: key || current!, baseURL: url || DEFAULT_BASE_URL, maxRetries: 0, timeout: 20_000 });
    await client.models.retrieve(CLAUDE_MODEL);
    return { ok: true, check: "Сохранено, Claude отвечает." };
  } catch (e) {
    return { ok: false, check: `Сохранено, но проверка не прошла: ${describeError(e)}` };
  }
}

export async function deleteClaude() {
  await deleteSettings(CLAUDE_KEY_SETTING, CLAUDE_URL_SETTING);
  revalidatePath("/integrations");
  revalidatePath("/integrations/claude");
  revalidatePath("/agents", "layout");
}
