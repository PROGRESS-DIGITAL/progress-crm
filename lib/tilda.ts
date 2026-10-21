import type { Prisma } from "@prisma/client";

// Поля формы Тильды называются так, как их назвали в редакторе, поэтому ищем по нескольким вариантам
const FIELD_ALIASES = {
  name: ["name", "имя", "fio", "фио", "your_name"],
  phone: ["phone", "телефон", "tel", "phone_number"],
  email: ["email", "e-mail", "почта", "mail"],
  companyName: ["company", "компания", "organization", "организация"],
  message: ["comments", "comment", "message", "сообщение", "комментарий", "textarea", "вопрос", "question"],
  formName: ["formname", "form_name"],
  pageUrl: ["referer", "referrer", "pageurl", "page_url", "page"],
} as const;

const UTM_KEYS = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
  utmTerm: "utm_term",
} as const;

// Служебные поля Тильды, которые не попадают в текст заявки
const SERVICE_FIELDS = new Set(["tranid", "formid", "cookies", "api_key", "apikey", "key", "test"]);

export type TildaLead = Pick<
  Prisma.LeadCreateInput,
  | "name"
  | "phone"
  | "email"
  | "companyName"
  | "message"
  | "formName"
  | "pageUrl"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "utmContent"
  | "utmTerm"
  | "externalId"
> & { raw: Record<string, string> };

export function isTildaTest(fields: Record<string, string>) {
  return fields.test === "test";
}

function pick(lower: Map<string, string>, keys: readonly string[]) {
  for (const k of keys) {
    const v = lower.get(k)?.trim();
    if (v) return v;
  }
  return null;
}

// Тильда кладёт UTM в cookie TILDAUTM вида "utm_source=yandex|||utm_medium=cpc"
function utmFromCookies(cookies: string | undefined): Record<string, string> {
  if (!cookies) return {};
  const match = cookies.match(/TILDAUTM=([^;]+)/);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const part of decodeURIComponent(match[1]).split("|||")) {
    const [k, ...rest] = part.split("=");
    if (k && rest.length) out[k.trim().toLowerCase()] = rest.join("=").trim();
  }
  return out;
}

export function parseTildaLead(fields: Record<string, string>): TildaLead {
  const lower = new Map(Object.entries(fields).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const cookieUtm = utmFromCookies(lower.get("cookies"));

  const lead: TildaLead = {
    name: pick(lower, FIELD_ALIASES.name),
    phone: pick(lower, FIELD_ALIASES.phone),
    email: pick(lower, FIELD_ALIASES.email),
    companyName: pick(lower, FIELD_ALIASES.companyName),
    message: pick(lower, FIELD_ALIASES.message),
    formName: pick(lower, FIELD_ALIASES.formName) ?? lower.get("formid") ?? null,
    pageUrl: pick(lower, FIELD_ALIASES.pageUrl),
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    externalId: lower.get("tranid")?.trim() || null,
    raw: Object.fromEntries(
      Object.entries(fields).filter(([k]) => !["api_key", "apikey", "key"].includes(k.toLowerCase())),
    ),
  };
  for (const [field, key] of Object.entries(UTM_KEYS) as [keyof typeof UTM_KEYS, string][]) {
    lead[field] = lower.get(key)?.trim() || cookieUtm[key] || null;
  }

  // Поля, которых нет среди известных, дописываем в сообщение, чтобы менеджер их увидел
  const known = new Set<string>([
    ...Object.values(FIELD_ALIASES).flat(),
    ...Object.values(UTM_KEYS),
    ...SERVICE_FIELDS,
  ]);
  const extra = Object.entries(fields)
    .filter(([k, v]) => !known.has(k.toLowerCase()) && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`);
  if (extra.length) lead.message = [lead.message, ...extra].filter(Boolean).join("\n");

  return lead;
}
