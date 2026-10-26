import { netFetch } from "@/lib/net";
// API Диадока: https://developer.kontur.ru/doc/diadoc-api/
// Вход через Контур по OpenID Connect (Device Flow): пользователь подтверждает вход кодом, CRM хранит refresh-токен
const API = process.env.DIADOC_API_URL ?? "https://diadoc-api.kontur.ru";
const IDENTITY = process.env.KONTUR_IDENTITY_URL ?? "https://identity.kontur.ru";
const SCOPE = process.env.DIADOC_SCOPE ?? "openid profile email offline_access Diadoc.PublicAPI";

export const DIADOC_CLIENT_SETTING = "diadoc.client"; // JSON: { clientId, clientSecret }
export const DIADOC_REFRESH_SETTING = "diadoc.refreshToken";
export const DIADOC_DEVICE_SETTING = "diadoc.device"; // JSON: { deviceCode, userCode, url, expiresAt, interval }
export const DIADOC_ORG_SETTING = "diadoc.org"; // JSON: DiadocOrg
export const DIADOC_IMPORT_SETTING = "diadoc.importedAt";

export type DiadocClient = { clientId: string; clientSecret: string };
export type DiadocOrg = { boxId: string; name: string; inn: string };

export class DiadocError extends Error {}

async function identity<T>(path: string, form: Record<string, string>) {
  const res = await netFetch(`${IDENTITY}${path}`, { method: "POST", body: new URLSearchParams(form) });
  const json = (await res.json().catch(() => null)) as (T & { error?: string; error_description?: string }) | null;
  if (!json) throw new DiadocError(`Контур ответил ${res.status}`);
  return { ok: res.ok, json };
}

export async function startDeviceLogin(c: DiadocClient) {
  const { ok, json } = await identity<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    expires_in: number;
    interval?: number;
  }>("/connect/deviceauthorization", { client_id: c.clientId, client_secret: c.clientSecret, scope: SCOPE });
  if (!ok) throw new DiadocError(json.error_description || json.error || "Контур не принял ключи приложения");
  return {
    deviceCode: json.device_code,
    userCode: json.user_code,
    url: json.verification_uri_complete ?? json.verification_uri,
    expiresAt: Date.now() + json.expires_in * 1000,
    interval: json.interval ?? 5,
  };
}

type Tokens = { access_token: string; refresh_token?: string; expires_in: number };

// null — пользователь ещё не подтвердил вход
export async function pollDeviceLogin(c: DiadocClient, deviceCode: string): Promise<Tokens | null> {
  const { ok, json } = await identity<Tokens>("/connect/token", {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: c.clientId,
    client_secret: c.clientSecret,
    scope: SCOPE,
    device_code: deviceCode,
  });
  if (ok) return json;
  if (json.error === "authorization_pending" || json.error === "slow_down") return null;
  throw new DiadocError(json.error === "expired_token" ? "Код устарел, начните вход заново" : json.error_description || json.error || "Вход не удался");
}

export async function refreshTokens(c: DiadocClient, refreshToken: string) {
  const { ok, json } = await identity<Tokens>("/connect/token", {
    grant_type: "refresh_token",
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: refreshToken,
  });
  if (!ok) throw new DiadocError("Вход в Диадок устарел, войдите заново");
  return json;
}

async function call<T>(accessToken: string, path: string, init?: { method?: string; body?: object }) {
  const res = await netFetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body && { "Content-Type": "application/json; charset=utf-8" }),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DiadocError(`Диадок ответил ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as T;
}

type Box = { BoxId: string; Title?: string };
type RussianAddress = {
  ZipCode?: string;
  Region?: string;
  Territory?: string;
  City?: string;
  Locality?: string;
  Street?: string;
  Building?: string;
  Block?: string;
  Apartment?: string;
};
export type DiadocOrganization = {
  OrgId?: string;
  Inn?: string;
  Kpp?: string;
  FullName?: string;
  ShortName?: string;
  Ogrn?: string;
  Address?: { RussianAddress?: RussianAddress; ForeignAddress?: { Address?: string } };
  Boxes?: Box[];
};

export async function getMyOrg(accessToken: string): Promise<DiadocOrg> {
  const r = await call<{ Organizations?: DiadocOrganization[] }>(accessToken, "/GetMyOrganizations");
  const org = r.Organizations?.find((o) => o.Boxes?.length);
  if (!org) throw new DiadocError("У учётной записи нет организации в Диадоке");
  return { boxId: org.Boxes![0].BoxId, name: org.ShortName || org.FullName || "Организация", inn: org.Inn ?? "" };
}

// Адрес одной строкой: «123456, Москва, ул Тверская, д 1, кв 2»
export function formatAddress(a: DiadocOrganization["Address"]): string | null {
  if (!a) return null;
  if (a.ForeignAddress?.Address) return a.ForeignAddress.Address;
  const r = a.RussianAddress;
  if (!r) return null;
  const parts = [
    r.ZipCode,
    r.Territory,
    r.City,
    r.Locality,
    r.Street,
    r.Building && `д ${r.Building}`,
    r.Block && `к ${r.Block}`,
    r.Apartment && `кв ${r.Apartment}`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export type CounteragentCompany = {
  name: string;
  inn: string;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  boxId: string | null;
};

export function companyFromOrganization(o: DiadocOrganization): CounteragentCompany | null {
  if (!o.Inn) return null;
  return {
    name: o.ShortName || o.FullName || o.Inn,
    inn: o.Inn,
    kpp: o.Kpp || null,
    ogrn: o.Ogrn || null,
    address: formatAddress(o.Address),
    boxId: o.Boxes?.[0]?.BoxId ?? null,
  };
}

// Все контрагенты, с которыми настроен обмен; Диадок отдаёт по 100 за раз
export async function getCounteragents(accessToken: string, boxId: string, query?: string) {
  const result: CounteragentCompany[] = [];
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const q = new URLSearchParams({ myBoxId: boxId, counteragentStatus: "IsMyCounteragent" });
    if (query) q.set("query", query);
    else if (after) q.set("afterIndexKey", after);
    const r = await call<{ Counteragents?: { IndexKey: string; Organization: DiadocOrganization }[] }>(
      accessToken,
      `/V3/GetCounteragents?${q}`,
    );
    const list = r.Counteragents ?? [];
    for (const c of list) {
      const company = companyFromOrganization(c.Organization);
      if (company) result.push(company);
    }
    if (query || list.length < 100) break;
    after = list.at(-1)!.IndexKey;
  }
  return result;
}

// Акт уходит черновиком: подписать и отправить его нужно в Диадоке своей электронной подписью
export function draftMessage(fromBoxId: string, toBoxId: string, pdf: Buffer, doc: { fileName: string; number: string; date: string; comment: string }) {
  return {
    FromBoxId: fromBoxId,
    ToBoxId: toBoxId,
    IsDraft: true,
    DocumentAttachments: [
      {
        TypeNamedId: "Nonformalized",
        SignedContent: { Content: pdf.toString("base64") },
        Comment: doc.comment,
        NeedRecipientSignature: true,
        Metadata: [
          { Key: "FileName", Value: doc.fileName },
          { Key: "DocumentNumber", Value: doc.number },
          { Key: "DocumentDate", Value: doc.date },
        ],
      },
    ],
  };
}

export async function postDraft(accessToken: string, message: ReturnType<typeof draftMessage>) {
  const r = await call<{ MessageId: string }>(accessToken, "/V3/PostMessage", { method: "POST", body: message });
  return r.MessageId;
}
