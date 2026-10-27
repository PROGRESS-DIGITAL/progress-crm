import type { Prisma } from "@prisma/client";
import { normalizePhone } from "./phone";

// Поля лида, которые заполняются из формы Тильды. Поля формы называются так, как их назвали
// в редакторе, поэтому для каждого поля CRM хранится список подходящих названий
export const TILDA_FIELDS = {
  name: "Имя",
  phone: "Телефон",
  email: "Email",
  companyName: "Компания",
  message: "Сообщение",
  formName: "Название формы",
  pageUrl: "Страница",
} as const;

export type TildaField = keyof typeof TILDA_FIELDS;
export type TildaFieldMap = Record<TildaField, string[]>;

export const DEFAULT_FIELD_MAP: TildaFieldMap = {
  name: ["name", "имя", "fio", "фио", "your_name"],
  phone: ["phone", "телефон", "tel", "phone_number"],
  email: ["email", "e-mail", "почта", "mail"],
  companyName: ["company", "компания", "organization", "организация"],
  message: ["comments", "comment", "message", "сообщение", "комментарий", "textarea", "вопрос", "question"],
  formName: ["formname", "form_name"],
  pageUrl: ["referer", "referrer", "pageurl", "page_url", "page"],
};

// Сохранённые настройки дополняем значениями по умолчанию: в базе могло не оказаться нового поля
export function normalizeFieldMap(value: unknown): TildaFieldMap {
  const saved = (value && typeof value === "object" ? value : {}) as Partial<Record<string, unknown>>;
  const map = { ...DEFAULT_FIELD_MAP };
  for (const field of Object.keys(TILDA_FIELDS) as TildaField[]) {
    const v = saved[field];
    if (Array.isArray(v)) map[field] = v.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  }
  return map;
}

const UTM_KEYS = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
  utmTerm: "utm_term",
} as const;

// Служебные поля Тильды, которые не попадают в текст заявки
export const SERVICE_FIELDS = new Set(["tranid", "formid", "cookies", "api_key", "apikey", "key", "test"]);
const SECRET_FIELDS = ["api_key", "apikey", "key"];

// Поля без секретов: их можно сохранить в заявке и показать в журнале
export function withoutSecrets(fields: Record<string, string>) {
  return Object.fromEntries(Object.entries(fields).filter(([k]) => !SECRET_FIELDS.includes(k.toLowerCase())));
}

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

export function parseTildaLead(fields: Record<string, string>, fieldMap: TildaFieldMap = DEFAULT_FIELD_MAP): TildaLead {
  const lower = new Map(Object.entries(fields).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const cookieUtm = utmFromCookies(lower.get("cookies"));

  const lead: TildaLead = {
    name: pick(lower, fieldMap.name),
    phone: normalizePhone(pick(lower, fieldMap.phone) ?? "") || null,
    email: pick(lower, fieldMap.email),
    companyName: pick(lower, fieldMap.companyName),
    message: pick(lower, fieldMap.message),
    formName: pick(lower, fieldMap.formName) ?? lower.get("formid") ?? null,
    pageUrl: pick(lower, fieldMap.pageUrl),
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    externalId: lower.get("tranid")?.trim() || null,
    raw: withoutSecrets(fields),
  };
  for (const [field, key] of Object.entries(UTM_KEYS) as [keyof typeof UTM_KEYS, string][]) {
    lead[field] = lower.get(key)?.trim() || cookieUtm[key] || null;
  }

  // Поля, которых нет среди известных, дописываем в сообщение, чтобы менеджер их увидел
  const known = new Set<string>([
    ...Object.values(fieldMap).flat(),
    ...Object.values(UTM_KEYS),
    ...SERVICE_FIELDS,
  ]);
  const extra = Object.entries(fields)
    .filter(([k, v]) => !known.has(k.toLowerCase()) && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`);
  if (extra.length) lead.message = [lead.message, ...extra].filter(Boolean).join("\n");

  return lead;
}
