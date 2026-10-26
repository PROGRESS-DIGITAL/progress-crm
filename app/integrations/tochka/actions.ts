"use server";

import { revalidatePath } from "next/cache";
import type { TokenState } from "@/components/token-form";
import {
  getAccounts,
  isNdsKind,
  TOCHKA_ACCOUNT_SETTING,
  TOCHKA_ACCOUNTS_SETTING,
  TOCHKA_NDS_SETTING,
  TOCHKA_TOKEN_SETTING,
  type TochkaAccount,
} from "@/lib/finance/tochka";
import { deleteSettings, getSetting, setSetting } from "@/lib/settings";

function revalidate() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/tochka");
  revalidatePath("/finance");
}

export async function saveTochkaToken(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const token = String(formData.get("token") ?? "").trim();
  if (token.split(".").length !== 3) return { error: "Это не похоже на JWT-токен Точки: он состоит из трёх частей через точку" };
  let accounts: TochkaAccount[];
  try {
    accounts = await getAccounts(token);
  } catch (e) {
    return { error: `Не получилось подключить Точку: ${e instanceof Error ? e.message : "ошибка"}` };
  }
  if (!accounts.length) return { error: "Токен рабочий, но рублёвых счетов в нём не видно: проверьте права токена" };
  await setSetting(TOCHKA_TOKEN_SETTING, token);
  await setSetting(TOCHKA_ACCOUNTS_SETTING, JSON.stringify(accounts));
  await setSetting(TOCHKA_ACCOUNT_SETTING, JSON.stringify(accounts[0]));
  revalidate();
  return { ok: `Точка подключена, счёт ${accounts[0].name}` };
}

export async function chooseTochkaSettings(formData: FormData) {
  const accounts = JSON.parse((await getSetting(TOCHKA_ACCOUNTS_SETTING)) ?? "[]") as TochkaAccount[];
  const account = accounts.find((a) => a.accountId === formData.get("accountId"));
  if (account) await setSetting(TOCHKA_ACCOUNT_SETTING, JSON.stringify(account));
  const nds = formData.get("nds");
  if (isNdsKind(nds)) await setSetting(TOCHKA_NDS_SETTING, nds);
  revalidate();
}

export async function deleteTochkaToken() {
  await deleteSettings(TOCHKA_TOKEN_SETTING, TOCHKA_ACCOUNTS_SETTING, TOCHKA_ACCOUNT_SETTING);
  revalidate();
}
