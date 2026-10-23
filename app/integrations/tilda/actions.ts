"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { DEFAULT_FIELD_MAP, TILDA_FIELDS, type TildaField, type TildaFieldMap } from "@/lib/tilda";
import { getTildaSettings, newWebhookKey } from "@/lib/tilda-settings";

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
