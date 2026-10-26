"use server";

import { revalidatePath } from "next/cache";
import type { TokenState } from "@/components/token-form";
import {
  DIADOC_CLIENT_SETTING,
  DIADOC_DEVICE_SETTING,
  DIADOC_IMPORT_SETTING,
  DIADOC_ORG_SETTING,
  DIADOC_REFRESH_SETTING,
  getMyOrg,
  pollDeviceLogin,
  startDeviceLogin,
  type DiadocClient,
} from "@/lib/finance/diadoc";
import { forgetDiadocToken } from "@/lib/finance/diadoc-service";
import { deleteSettings, getSetting, setSetting } from "@/lib/settings";

function revalidate() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/diadoc");
}

// Ключи приложения из кабинета интегратора Контура; сразу начинаем вход
export async function saveDiadocClient(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("token") ?? "").trim();
  if (!clientId || !clientSecret) return { error: "Нужны оба значения: client_id и API-ключ (client_secret)" };
  const client: DiadocClient = { clientId, clientSecret };
  try {
    const device = await startDeviceLogin(client);
    await setSetting(DIADOC_CLIENT_SETTING, JSON.stringify(client));
    await setSetting(DIADOC_DEVICE_SETTING, JSON.stringify(device));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Контур не принял ключи" };
  }
  revalidate();
  return { ok: "Подтвердите вход в Контуре по ссылке ниже" };
}

export async function restartDiadocLogin() {
  const client = await getSetting(DIADOC_CLIENT_SETTING);
  if (!client) return;
  await setSetting(DIADOC_DEVICE_SETTING, JSON.stringify(await startDeviceLogin(JSON.parse(client))));
  revalidate();
}

export type LoginCheck = { done?: boolean; error?: string };

// Страница спрашивает каждые несколько секунд, подтвердил ли пользователь вход
export async function checkDiadocLogin(): Promise<LoginCheck> {
  const [clientJson, deviceJson] = await Promise.all([getSetting(DIADOC_CLIENT_SETTING), getSetting(DIADOC_DEVICE_SETTING)]);
  if (!clientJson || !deviceJson) return { error: "Вход не начат" };
  const device = JSON.parse(deviceJson) as { deviceCode: string; expiresAt: number };
  if (device.expiresAt < Date.now()) return { error: "Код устарел, начните вход заново" };
  try {
    const tokens = await pollDeviceLogin(JSON.parse(clientJson), device.deviceCode);
    if (!tokens) return {};
    if (!tokens.refresh_token) return { error: "Контур не выдал refresh-токен: проверьте, что у приложения есть offline_access" };
    const org = await getMyOrg(tokens.access_token);
    await setSetting(DIADOC_REFRESH_SETTING, tokens.refresh_token);
    await setSetting(DIADOC_ORG_SETTING, JSON.stringify(org));
    await deleteSettings(DIADOC_DEVICE_SETTING);
    forgetDiadocToken();
    revalidate();
    return { done: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Вход не удался" };
  }
}

export async function deleteDiadoc() {
  await deleteSettings(DIADOC_CLIENT_SETTING, DIADOC_DEVICE_SETTING, DIADOC_REFRESH_SETTING, DIADOC_ORG_SETTING, DIADOC_IMPORT_SETTING);
  forgetDiadocToken();
  revalidate();
}
