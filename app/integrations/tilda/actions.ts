"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { DEFAULT_FIELD_MAP, TILDA_FIELDS, type TildaField, type TildaFieldMap } from "@/lib/tilda";
import { getTildaSettings, newWebhookKey } from "@/lib/tilda-settings";
import { notifyOwner, ownerTelegramReady } from "@/lib/auth/notify";
import { newLeadText, setLeadNotifyEnabled } from "@/lib/lead-notify";

function revalidateTilda() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/tilda");
}

export async function saveFieldMap(_prev: FormState, formData: FormData): Promise<FormState> {
  await getTildaSettings();
  const fieldMap = {} as TildaFieldMap;
  const errors: Record<string, string> = {};
  for (const field of Object.keys(TILDA_FIELDS) as TildaField[]) {
    const names = String(formData.get(field) ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    fieldMap[field] = [...new Set(names)];
  }
  if (fieldMap.phone.length === 0 && fieldMap.email.length === 0) {
    errors.phone = "Укажите поле телефона или email, иначе по заявке не с кем будет связаться";
  }
  if (Object.keys(errors).length) {
    const values: Record<string, string> = {};
    formData.forEach((v, k) => {
      if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
    });
    return { errors, values };
  }
  await db.tildaSettings.update({ where: { id: 1 }, data: { fieldMap } });
  revalidateTilda();
  return { saved: true };
}

export async function resetFieldMap() {
  await getTildaSettings();
  await db.tildaSettings.update({ where: { id: 1 }, data: { fieldMap: DEFAULT_FIELD_MAP } });
  revalidateTilda();
}

export async function setTildaEnabled(enabled: boolean) {
  await getTildaSettings();
  await db.tildaSettings.update({ where: { id: 1 }, data: { enabled } });
  revalidateTilda();
}

export async function regenerateWebhookKey() {
  await getTildaSettings();
  await db.tildaSettings.update({ where: { id: 1 }, data: { webhookKey: newWebhookKey() } });
  revalidateTilda();
}

export async function setLeadNotify(on: boolean) {
  await setLeadNotifyEnabled(on);
  revalidateTilda();
}

// Пример уведомления на вымышленной заявке, чтобы увидеть, как оно выглядит в Telegram
export async function sendTestLeadNotice(): Promise<{ error?: string; ok?: string }> {
  if (!(await ownerTelegramReady())) return { error: "Сначала привяжите Telegram в «Интеграции» → Telegram" };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const text = newLeadText(
    {
      id: "example",
      name: "Анна (пример)",
      phone: "+7 900 000-00-00",
      formName: "Заявка на сайт",
      message: "Это проверка: так будут выглядеть уведомления о новых заявках с сайта.",
    },
    `${proto}://${host}`,
  ).replace(/\nОткрыть в CRM: .*$/, `\nОткрыть в CRM: ${proto}://${host}/leads`);
  const sent = await notifyOwner(text);
  return sent ? { ok: "Отправил, проверьте Telegram" } : { error: "Telegram не доставил сообщение" };
}
