import { Agent, fetch as undiciFetch } from "undici";
import { networkError } from "@/lib/net";
import { statementKey, type StatementPayment } from "./statement-1c";

// СберБизнес API (прямая интеграция): https://developers.sber.ru/docs/ru/sber-api/overview
// Вход — OAuth Authorization Code через СберБизнес ID, запросы к API — по TLS-сертификату, который выдаёт банк
const AUTH = process.env.SBER_AUTH_URL ?? "https://sbi.sberbank.ru:9443";
const API = process.env.SBER_API_URL ?? "https://fintech.sberbank.ru:9443";
const SCOPE = process.env.SBER_SCOPE ?? "openid GET_CLIENT_ACCOUNTS GET_STATEMENT_ACCOUNT GET_STATEMENT_TRANSACTION";

export const SBER_CLIENT_SETTING = "sber.client"; // JSON: SberClient
export const SBER_TOKENS_SETTING = "sber.tokens"; // JSON: SberTokens
export const SBER_ACCOUNT_SETTING = "sber.account"; // номер расчётного счёта
export const SBER_ACCOUNTS_SETTING = "sber.accounts"; // JSON: SberAccount[]
export const SBER_STATE_SETTING = "sber.state"; // JSON: { state, nonce, at } — вход, начатый на странице интеграции
export const SBER_HISTORY_SETTING = "sber.historyLoaded";

export type SberClient = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  // Сертификат из банка: .pfx/.p12 в base64 и пароль к нему
  pfx: string;
  passphrase: string;
};
export type SberTokens = { accessToken: string; refreshToken: string; expiresAt: number };
export type SberAccount = { number: string; name: string };

export class SberError extends Error {}

const agents = new Map<string, Agent>();
function agentFor(c: SberClient) {
  const key = `${c.clientId}:${c.pfx.length}:${c.pfx.slice(-32)}`;
  let a = agents.get(key);
  if (!a) {
    a = new Agent({ connect: { pfx: Buffer.from(c.pfx, "base64"), passphrase: c.passphrase } });
    agents.set(key, a);
  }
  return a;
}

async function sberFetch(c: SberClient, url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  try {
    return await undiciFetch(url, { ...init, dispatcher: agentFor(c) });
  } catch (e) {
    const msg = (e as { cause?: { message?: string } })?.cause?.message ?? "";
    if (/mac verify|pkcs12|bad decrypt|unsupported/i.test(msg)) throw new SberError("Не получилось открыть сертификат: проверьте файл и пароль к нему");
    throw new SberError(networkError(e, new URL(url).host));
  }
}

type ErrorBody = { error?: string; error_description?: string; message?: string; cause?: string; checks?: { message?: string }[] };

function errorText(json: ErrorBody | null, status: number) {
  return (
    json?.error_description ||
    json?.message ||
    json?.checks?.map((c) => c.message).filter(Boolean).join("; ") ||
    json?.error ||
    `СберБизнес ответил ${status}`
  );
}

export function authorizeUrl(c: Pick<SberClient, "clientId" | "redirectUri">, state: string, nonce: string) {
  const q = new URLSearchParams({ response_type: "code", client_id: c.clientId, redirect_uri: c.redirectUri, scope: SCOPE, state, nonce });
  return `${AUTH}/ic/sso/api/v2/oauth/authorize?${q}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

async function token(c: SberClient, form: Record<string, string>, refreshToken?: string): Promise<SberTokens> {
  const res = await sberFetch(c, `${API}/ic/sso/api/v2/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ ...form, client_id: c.clientId, client_secret: c.clientSecret }).toString(),
  });
  const json = (await res.json().catch(() => null)) as (TokenResponse & ErrorBody) | null;
  if (!res.ok || !json?.access_token) {
    if (json?.error === "invalid_grant") throw new SberError("Вход в СберБизнес устарел: войдите заново на странице интеграции");
    if (json?.error === "invalid_client") throw new SberError("СберБизнес не принял client_id или client_secret: секрет действует ограниченное время, обновите его");
    throw new SberError(errorText(json, res.status));
  }
  return {
    accessToken: json.access_token,
    // Сбер выдаёт новый refresh-токен при каждом обновлении, старый скоро перестаёт работать
    refreshToken: json.refresh_token ?? refreshToken ?? "",
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

export const exchangeCode = (c: SberClient, code: string) =>
  token(c, { grant_type: "authorization_code", code, redirect_uri: c.redirectUri });

export const refreshTokens = (c: SberClient, refreshToken: string) =>
  token(c, { grant_type: "refresh_token", refresh_token: refreshToken }, refreshToken);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(c: SberClient, accessToken: string, path: string, tries = 6): Promise<T> {
  for (let i = 0; ; i++) {
    const res = await sberFetch(c, path.startsWith("http") ? path : `${API}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    const json = (await res.json().catch(() => null)) as (T & ErrorBody) | null;
    if (res.ok && json) return json;
    // Выписку банк готовит асинхронно: пока она собирается, отвечает «в обработке» и просит повторить
    if (i < tries && /PROCESSING|NOT_READY|IN_PROGRESS/i.test(JSON.stringify(json ?? ""))) {
      await sleep(2000);
      continue;
    }
    if (res.status === 401) throw new SberError("СберБизнес не пустил: войдите заново на странице интеграции");
    throw new SberError(errorText(json, res.status));
  }
}

type ClientInfo = {
  shortName?: string;
  fullName?: string;
  accounts?: { number?: string; accountNumber?: string; currencyCode?: string; state?: string; status?: string; name?: string; type?: string }[];
};

// Рублёвые открытые счета организации
export async function getAccounts(c: SberClient, accessToken: string): Promise<SberAccount[]> {
  const info = await get<ClientInfo>(c, accessToken, "/fintech/api/v1/client-info");
  return (info.accounts ?? [])
    .map((a) => ({ ...a, number: a.number ?? a.accountNumber ?? "" }))
    .filter((a) => a.number && (!a.currencyCode || ["810", "643", "RUB", "RUR"].includes(a.currencyCode)))
    .filter((a) => !/CLOSED|BLOCKED/i.test(a.state ?? a.status ?? ""))
    .map((a) => ({ number: a.number, name: a.name || a.type || info.shortName || a.number }));
}

export type SberTransaction = {
  uuid?: string;
  number?: string;
  direction?: string; // CREDIT — поступление, DEBIT — списание
  operationDate?: string;
  documentDate?: string;
  amount?: { amount?: number | string };
  amountRub?: { amount?: number | string };
  paymentPurpose?: string;
  rurTransfer?: { payerName?: string; payerInn?: string; payerAccount?: string; payeeAccount?: string };
};

type TransactionsPage = { transactions?: SberTransaction[]; _links?: { rel?: string; href?: string }[] };

// Выписка Сбера отдаётся за один день и по страницам: ссылка на следующую лежит в _links
export async function dayTransactions(c: SberClient, accessToken: string, account: string, date: string) {
  const all: SberTransaction[] = [];
  let page = 1;
  for (;;) {
    const q = new URLSearchParams({ accountNumber: account, statementDate: date, page: String(page) });
    const r = await get<TransactionsPage>(c, accessToken, `/fintech/api/v1/statement/transactions?${q}`);
    all.push(...(r.transactions ?? []));
    if (!r._links?.some((l) => l.rel === "next") || page >= 100) return all;
    page++;
  }
}

// Только поступления; ключ совпадает с ключом из файла выписки 1С, чтобы платежи не задвоились
export function incomingPayments(account: string, transactions: SberTransaction[]): StatementPayment[] {
  const out: StatementPayment[] = [];
  for (const t of transactions) {
    if (t.direction?.toUpperCase() !== "CREDIT") continue;
    const amount = Number(t.amountRub?.amount ?? t.amount?.amount);
    const day = (t.operationDate ?? t.documentDate ?? "").slice(0, 10);
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const date = new Date(`${day}T12:00:00+03:00`);
    const payerInn = t.rurTransfer?.payerInn?.replace(/\D/g, "") || null;
    out.push({
      transactionId: statementKey({
        account,
        date,
        number: t.number ?? t.uuid ?? "",
        amount,
        payer: payerInn ?? t.rurTransfer?.payerAccount ?? "",
      }),
      date,
      amount: Math.round(amount),
      payerName: t.rurTransfer?.payerName?.trim() || null,
      payerInn,
      purpose: t.paymentPurpose ?? null,
    });
  }
  return out;
}
