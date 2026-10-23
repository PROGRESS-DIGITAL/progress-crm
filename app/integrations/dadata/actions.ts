"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { DADATA_KEY_SETTING, findPartyByInn } from "@/lib/dadata";

export type DadataKeyState = { error?: string; saved?: boolean; check?: string } | undefined;

// ИНН Сбербанка: на нём проверяем, что ключ рабочий
const CHECK_INN = "7707083893";

export async function saveDadataKey(_prev: DadataKeyState, formData: FormData): Promise<DadataKeyState> {
  const key = String(formData.get("apiKey") ?? "").trim();
  if (!/^[0-9a-f]{40}$/i.test(key)) return { error: "Ключ DaData — 40 символов из цифр и латинских букв a–f" };
  await db.appSetting.upsert({
    where: { key: DADATA_KEY_SETTING },
    update: { value: key },
    create: { key: DADATA_KEY_SETTING, value: key },
  });
  revalidatePath("/integrations");
  revalidatePath("/integrations/dadata");
  const result = await findPartyByInn(CHECK_INN, key);
  return {
    saved: true,
    check: "party" in result ? "Ключ сохранён и работает." : `Ключ сохранён, но проверка не прошла: ${result.error}`,
  };
}

export async function deleteDadataKey() {
  await db.appSetting.deleteMany({ where: { key: DADATA_KEY_SETTING } });
  revalidatePath("/integrations");
  revalidatePath("/integrations/dadata");
}
