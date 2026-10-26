// API Точки: https://developers.tochka.com/docs/tochka-api/
// Авторизация — JWT-токен, выпущенный в интернет-банке («Интеграции и API»)
const API = process.env.TOCHKA_API_URL ?? "https://enter.tochka.com/uapi";
export const TOCHKA_TOKEN_SETTING = "tochka.jwt";
export const TOCHKA_ACCOUNT_SETTING = "tochka.account"; // JSON: TochkaAccount
export const TOCHKA_NDS_SETTING = "tochka.nds";
export const TOCHKA_ACCOUNTS_SETTING = "tochka.accounts"; // JSON: TochkaAccount[]

export type TochkaAccount = { accountId: string; customerCode: string; name: string };

export const NDS_KINDS = {
  without_nds: "Без НДС",
  nds_0: "НДС 0%",
  nds_5: "НДС 5%",
  nds_7: "НДС 7%",
  nds_10: "НДС 10%",
  nds_20: "НДС 20%",
} as const;
export type NdsKind = keyof typeof NDS_KINDS;

export function isNdsKind(v: unknown): v is NdsKind {
  return typeof v === "string" && v in NDS_KINDS;
}

export class TochkaError extends Error {}

async function call<T>(token: string, path: string, init?: { method?: string; body?: object }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as
    | (T & { message?: string; Errors?: { message?: string }[] })
    | null;
  if (!res.ok || !json) {
    const msg = json?.Errors?.map((e) => e.message).filter(Boolean).join("; ") || json?.message;
    throw new TochkaError(msg || `Точка ответила ${res.status}`);
  }
  return json;
}

// Счета организации: берём рублёвые; name — номер счёта для выбора в настройках
export async function getAccounts(token: string): Promise<TochkaAccount[]> {
  const r = await call<{ Data: { Account: { accountId: string; customerCode: string; currency: string; status: string }[] } }>(
    token,
    "/open-banking/v1.0/accounts",
  );
  return r.Data.Account.filter((a) => a.currency === "RUB" && a.status !== "Disabled" && a.status !== "Deleted").map((a) => ({
    accountId: a.accountId,
    customerCode: a.customerCode,
    name: a.accountId.split("/")[0],
  }));
}

export type Party = { inn: string; kpp: string | null; name: string; address: string | null };

export type DocInput = {
  account: TochkaAccount;
  party: Party;
  number: string;
  date: string; // YYYY-MM-DD по Москве
  title: string;
  amount: number;
  nds: NdsKind;
};

const NDS_RATE: Record<NdsKind, number> = { without_nds: 0, nds_0: 0, nds_5: 5, nds_7: 7, nds_10: 10, nds_20: 20 };

// НДС внутри суммы: 120 ₽ с НДС 20% → 20 ₽
export function ndsIncluded(amount: number, nds: NdsKind) {
  const rate = NDS_RATE[nds];
  return rate ? Math.round((amount * rate * 100) / (100 + rate)) / 100 : 0;
}

function secondSide(p: Party) {
  return {
    taxCode: p.inn,
    // ИНН из 12 цифр — у ИП, из 10 — у организации
    type: p.inn.length === 12 ? "ip" : "company",
    secondSideName: p.name,
    ...(p.kpp && { kpp: p.kpp }),
    ...(p.address && { legalAddress: p.address }),
  };
}

function content(d: DocInput) {
  const totalNds = ndsIncluded(d.amount, d.nds);
  return {
    Positions: [
      {
        positionName: d.title,
        unitCode: "услуга.",
        ndsKind: d.nds,
        price: d.amount,
        quantity: 1,
        totalAmount: d.amount,
        ...(totalNds && { totalNds }),
      },
    ],
    date: d.date,
    totalAmount: d.amount,
    ...(totalNds && { totalNds }),
    number: d.number,
  };
}

export function invoiceBody(d: DocInput) {
  return {
    Data: {
      accountId: d.account.accountId,
      customerCode: d.account.customerCode,
      SecondSide: secondSide(d.party),
      Content: { Invoice: content(d) },
    },
  };
}

export function actBody(d: DocInput, invoiceTochkaId?: string | null) {
  return {
    Data: {
      accountId: d.account.accountId,
      customerCode: d.account.customerCode,
      SecondSide: secondSide(d.party),
      ...(invoiceTochkaId && { documentId: invoiceTochkaId }),
      Content: { Act: content(d) },
    },
  };
}

export async function createInvoice(token: string, d: DocInput) {
  const r = await call<{ Data: { documentId: string } }>(token, "/invoice/v1.0/bills", { method: "POST", body: invoiceBody(d) });
  return r.Data.documentId;
}

export async function createAct(token: string, d: DocInput, invoiceTochkaId?: string | null) {
  const r = await call<{ Data: { documentId: string } }>(token, "/invoice/v1.0/closing-documents", {
    method: "POST",
    body: actBody(d, invoiceTochkaId),
  });
  return r.Data.documentId;
}

export async function invoicePaymentStatus(token: string, customerCode: string, documentId: string) {
  const r = await call<{ Data: { paymentStatus: "payment_waiting" | "payment_expired" | "payment_paid" } }>(
    token,
    `/invoice/v1.0/bills/${customerCode}/${documentId}/payment-status`,
  );
  return r.Data.paymentStatus;
}

// PDF счёта или акта
export async function documentPdf(token: string, kind: "bills" | "closing-documents", customerCode: string, documentId: string) {
  const res = await fetch(`${API}/invoice/v1.0/${kind}/${customerCode}/${documentId}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new TochkaError(`Точка не отдала PDF: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function sendDocumentEmail(
  token: string,
  kind: "bills" | "closing-documents",
  customerCode: string,
  documentId: string,
  email: string,
) {
  await call(token, `/invoice/v1.0/${kind}/${customerCode}/${documentId}/email`, {
    method: "POST",
    body: { Data: { email } },
  });
}

export type Transaction = {
  transactionId?: string;
  creditDebitIndicator: "Credit" | "Debit";
  status?: string;
  documentProcessDate?: string;
  description?: string;
  Amount: { amount: number };
  DebtorParty?: { inn?: string; name?: string };
};

type Statement = { statementId?: string; status: string; Transaction?: Transaction[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Выписка за период: Точка готовит её асинхронно, поэтому заказываем и ждём статуса Ready
export async function getStatement(token: string, accountId: string, from: string, to: string, waitMs = 1500, tries = 20) {
  const init = await call<{ Data: { Statement: Statement } }>(token, "/open-banking/v1.0/statements", {
    method: "POST",
    body: { Data: { Statement: { accountId, startDateTime: from, endDateTime: to } } },
  });
  const id = init.Data.Statement.statementId;
  if (!id) throw new TochkaError("Точка не вернула номер выписки");
  for (let i = 0; i < tries; i++) {
    const r = await call<{ Data: { Statement: Statement[] } }>(
      token,
      `/open-banking/v1.0/accounts/${encodeURIComponent(accountId)}/statements/${id}`,
    );
    const s = r.Data.Statement[0];
    if (s?.status === "Ready") return s.Transaction ?? [];
    await sleep(waitMs);
  }
  throw new TochkaError("Выписка не успела подготовиться, попробуйте ещё раз");
}

// Поступления: только входящие операции
export function incomingPayments(transactions: Transaction[]) {
  return transactions
    .filter((t) => t.creditDebitIndicator === "Credit" && t.transactionId)
    .map((t) => ({
      transactionId: t.transactionId!,
      date: new Date(`${t.documentProcessDate ?? new Date().toISOString().slice(0, 10)}T12:00:00+03:00`),
      amount: Math.round(t.Amount.amount),
      payerName: t.DebtorParty?.name ?? null,
      payerInn: t.DebtorParty?.inn ?? null,
      purpose: t.description ?? null,
    }));
}
