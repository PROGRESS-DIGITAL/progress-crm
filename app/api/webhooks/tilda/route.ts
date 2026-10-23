import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isTildaTest, parseTildaLead, withoutSecrets } from "@/lib/tilda";
import { getTildaSettings } from "@/lib/tilda-settings";

async function readFields(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json()) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
  }
  const form = await req.formData();
  const fields: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") fields[k] = v;
  });
  return fields;
}

function keyMatches(given: string | null | undefined, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const LOG_DAYS = 30;

type LogStatus = "ok" | "duplicate" | "test" | "forbidden" | "disabled";

async function log(status: LogStatus, fields: Record<string, string>, leadId: string | null = null) {
  await db.webhookLog.create({ data: { source: "tilda", status, fields: withoutSecrets(fields), leadId } });
  // Журнал нужен для настройки и разбора проблем, старые записи не храним
  await db.webhookLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - LOG_DAYS * 86_400_000) } } });
  revalidatePath("/integrations/tilda");
}

// Тильда шлёт заявки POST-запросом и ждёт ответ 200 в течение 5 секунд
export async function POST(req: Request) {
  const settings = await getTildaSettings();

  let fields: Record<string, string>;
  try {
    fields = await readFields(req);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // Ключ можно передать в адресе (?key=), заголовком или полем api_key (настройка «API-ключ» в Тильде)
  const given =
    new URL(req.url).searchParams.get("key") ??
    req.headers.get("x-api-key") ??
    fields.api_key ??
    fields.apikey;
  if (!keyMatches(given, settings.webhookKey)) {
    await log("forbidden", fields);
    return new Response("forbidden", { status: 403 });
  }

  if (isTildaTest(fields)) {
    await log("test", fields);
    return new Response("ok");
  }
  // Выключенная интеграция отвечает «ok», чтобы Тильда не считала хук сломанным, но лид не создаёт
  if (!settings.enabled) {
    await log("disabled", fields);
    return new Response("ok");
  }

  const { raw, ...lead } = parseTildaLead(fields, settings.fieldMap);
  try {
    const created = await db.lead.create({ data: { ...lead, raw, source: "TILDA" } });
    await log("ok", fields, created.id);
  } catch (e) {
    // Повторная доставка той же заявки — не ошибка
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    await log("duplicate", fields);
  }
  revalidatePath("/leads");
  return new Response("ok");
}
