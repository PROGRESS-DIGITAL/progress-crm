import { getSetting, setSetting } from "@/lib/settings";
import { getTochka, savePayments } from "./documents";
import {
  dayTransactions,
  getAccounts,
  incomingPayments,
  refreshTokens,
  SBER_ACCOUNT_SETTING,
  SBER_ACCOUNTS_SETTING,
  SBER_CLIENT_SETTING,
  SBER_HISTORY_SETTING,
  SBER_TOKENS_SETTING,
  SberError,
  type SberAccount,
  type SberClient,
  type SberTokens,
} from "./sber";
import { parseStatement1C, decodeStatement, StatementError } from "./statement-1c";

const moscowDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });

export async function getSberClient() {
  const json = await getSetting(SBER_CLIENT_SETTING);
  return json ? (JSON.parse(json) as SberClient) : null;
}

// Сбер подключён: есть ключи приложения, выполнен вход и выбран счёт
export async function getSber() {
  const [client, tokens, account] = await Promise.all([getSberClient(), getSetting(SBER_TOKENS_SETTING), getSetting(SBER_ACCOUNT_SETTING)]);
  if (!client || !tokens || !account) return null;
  return { client, tokens: JSON.parse(tokens) as SberTokens, account };
}

export async function saveSberLogin(client: SberClient, tokens: SberTokens) {
  await setSetting(SBER_TOKENS_SETTING, JSON.stringify(tokens));
  const accounts = await getAccounts(client, tokens.accessToken);
  if (!accounts.length) throw new SberError("Вход прошёл, но рублёвых счетов не видно: проверьте права приложения в СберБизнесе");
  await setSetting(SBER_ACCOUNTS_SETTING, JSON.stringify(accounts));
  const current = await getSetting(SBER_ACCOUNT_SETTING);
  if (!current || !accounts.some((a) => a.number === current)) await setSetting(SBER_ACCOUNT_SETTING, accounts[0].number);
  return accounts;
}

export async function sberAccounts() {
  return JSON.parse((await getSetting(SBER_ACCOUNTS_SETTING)) ?? "[]") as SberAccount[];
}

// Токен доступа живёт около часа: обновляем заранее и сразу сохраняем новый refresh-токен
async function accessToken(sber: NonNullable<Awaited<ReturnType<typeof getSber>>>) {
  if (sber.tokens.expiresAt - 60_000 > Date.now()) return sber.tokens.accessToken;
  const tokens = await refreshTokens(sber.client, sber.tokens.refreshToken);
  await setSetting(SBER_TOKENS_SETTING, JSON.stringify(tokens));
  sber.tokens = tokens;
  return tokens.accessToken;
}

// Поступления за последние дни: выписка Сбера запрашивается по одному дню
export async function syncSber(days = 3) {
  const sber = await getSber();
  if (!sber) return { added: 0, paid: 0 };
  let added = 0;
  let paid = 0;
  for (let i = days - 1; i >= 0; i--) {
    const date = moscowDate(new Date(Date.now() - i * 86_400_000));
    const token = await accessToken(sber);
    const r = await savePayments(incomingPayments(sber.account, await dayTransactions(sber.client, token, sber.account, date)));
    added += r.added;
    paid += r.paid;
  }
  return { added, paid };
}

// История поступлений за год для дашборда: один раз после подключения
export async function loadSberHistory() {
  if (!(await getSber()) || (await getSetting(SBER_HISTORY_SETTING))) return;
  await syncSber(400);
  await setSetting(SBER_HISTORY_SETTING, new Date().toISOString());
}

// Файл выписки для 1С из интернет-банка: подходит для Сбера без API и для любого другого банка
export async function importStatementFile(buf: Uint8Array) {
  const parsed = parseStatement1C(decodeStatement(buf));
  // Поступления на счёт в Точке уже приходят по API Точки с другими номерами: из файла их не берём, чтобы не задвоить
  const tochka = await getTochka();
  const own = tochka?.account.name;
  const payments = parsed.payments.filter((p) => p.account !== own);
  if (!parsed.payments.length) throw new StatementError("В выписке нет поступлений на ваш счёт");
  const r = await savePayments(payments.map(({ account: _account, ...p }) => p));
  return { ...r, total: parsed.payments.length, tochkaSkipped: parsed.payments.length - payments.length };
}
