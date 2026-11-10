"use server";

import { randomBytes } from "node:crypto";
import { createSecureContext } from "node:tls";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TokenState } from "@/components/token-form";
import { authorizeUrl, SBER_ACCOUNT_SETTING, SBER_CLIENT_SETTING, SBER_STATE_SETTING, SBER_TOKENS_SETTING, SBER_ACCOUNTS_SETTING, type SberClient } from "@/lib/finance/sber";
import { getSberClient, sberAccounts } from "@/lib/finance/sber-service";
import { deleteSettings, setSetting } from "@/lib/settings";

function revalidate() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/sber");
  revalidatePath("/finance");
}

// Ключи приложения и сертификат из банка. Новый сертификат не обязателен: старый остаётся, если файл не выбран
export async function saveSberClient(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const old = await getSberClient();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim() || old?.clientSecret || "";
  const redirectUri = String(formData.get("redirectUri") ?? "").trim();
  const file = formData.get("certificate");
  const newPassphrase = String(formData.get("passphrase") ?? "");
  if (!clientId || !clientSecret) return { error: "Укажите client_id и client_secret из СберБизнеса" };
  if (!/^https?:\/\//.test(redirectUri)) return { error: "Redirect URI — полный адрес, например https://crm.progrs.ru/integrations/sber/callback" };
  let pfx = old?.pfx ?? "";
  let passphrase = old?.passphrase ?? "";
  if (file instanceof File && file.size > 0) {
    pfx = Buffer.from(await file.arrayBuffer()).toString("base64");
    passphrase = newPassphrase;
  } else if (newPassphrase) {
    passphrase = newPassphrase;
  }
  if (!pfx) return { error: "Загрузите сертификат .pfx или .p12, который выдал банк" };
  try {
    createSecureContext({ pfx: Buffer.from(pfx, "base64"), passphrase });
  } catch {
    return { error: "Сертификат не открывается: проверьте файл (.pfx или .p12) и пароль к нему" };
  }
  const client: SberClient = { clientId, clientSecret, redirectUri, pfx, passphrase };
  await setSetting(SBER_CLIENT_SETTING, JSON.stringify(client));
  revalidate();
  return { ok: "Сохранено. Теперь войдите через СберБизнес" };
}

// Вход через СберБизнес ID: банк вернёт пользователя на /integrations/sber/callback с кодом
export async function startSberLogin() {
  const client = await getSberClient();
  if (!client) redirect("/integrations/sber");
  const state = randomBytes(24).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  await setSetting(SBER_STATE_SETTING, JSON.stringify({ state, nonce, at: Date.now() }));
  redirect(authorizeUrl(client, state, nonce));
}

export async function chooseSberAccount(formData: FormData) {
  const number = String(formData.get("account") ?? "");
  if ((await sberAccounts()).some((a) => a.number === number)) await setSetting(SBER_ACCOUNT_SETTING, number);
  revalidate();
}

export async function deleteSber() {
  await deleteSettings(SBER_CLIENT_SETTING, SBER_TOKENS_SETTING, SBER_ACCOUNT_SETTING, SBER_ACCOUNTS_SETTING, SBER_STATE_SETTING);
  revalidate();
}
