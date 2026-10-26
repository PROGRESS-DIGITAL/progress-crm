import { db } from "@/lib/db";

export async function getSetting(key: string) {
  return (await db.appSetting.findUnique({ where: { key } }))?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function deleteSettings(...keys: string[]) {
  await db.appSetting.deleteMany({ where: { key: { in: keys } } });
}
