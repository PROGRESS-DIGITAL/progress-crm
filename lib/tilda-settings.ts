import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { DEFAULT_FIELD_MAP, normalizeFieldMap } from "@/lib/tilda";

export function newWebhookKey() {
  return randomBytes(16).toString("hex");
}

// Настройки создаются при первом обращении; ключ берём из TILDA_WEBHOOK_KEY, чтобы старый адрес хука продолжил работать
export async function getTildaSettings() {
  const row = await db.tildaSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      webhookKey: process.env.TILDA_WEBHOOK_KEY || newWebhookKey(),
      fieldMap: DEFAULT_FIELD_MAP,
    },
  });
  return { ...row, fieldMap: normalizeFieldMap(row.fieldMap) };
}
