// Выписка в формате обмена с 1С (1CClientBankExchange, файл kl_to_1c.txt). Её выгружает интернет-банк
// любого банка, в том числе СберБизнес: «Выписка» → «Экспорт» → «1С»
export type StatementPayment = {
  transactionId: string;
  date: Date;
  amount: number;
  payerName: string | null;
  payerInn: string | null;
  purpose: string | null;
};

export class StatementError extends Error {}

// Банки отдают файл в Windows-1251, реже в UTF-8
export function decodeStatement(buf: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1251").decode(buf);
  }
}

// 05.11.2026 → полдень по Москве, как у выписки Точки: дата не съезжает на соседние сутки
export function parseRuDate(s: string | undefined) {
  const m = s?.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00+03:00`) : null;
}

const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });

// Один и тот же платёж из файла и из API банка должен получить один ключ, иначе он задвоится
export function statementKey(p: { account: string; date: Date; number: string; amount: number; payer: string }) {
  return `stmt:${p.account}:${day(p.date)}:${p.number}:${Math.round(p.amount * 100)}:${p.payer}`;
}

// В поле «Плательщик» банки пишут «ИНН 7701234567 ООО "Ромашка"», а иногда и счёт с банком через «//»
function cleanName(s: string | undefined) {
  const name = s?.replace(/^ИНН\s*\d+\s*/i, "").split("//")[0].trim();
  return name || null;
}

export type ParsedStatement = { accounts: string[]; payments: (StatementPayment & { account: string })[]; skipped: number };

// Поступления на свои счета: свои счета перечислены в заголовке (РасчСчет=…)
export function parseStatement1C(text: string): ParsedStatement {
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.trim().startsWith("1CClientBankExchange")) {
    throw new StatementError("Это не выписка для 1С: в интернет-банке выберите экспорт выписки в формате 1С (файл kl_to_1c.txt)");
  }
  const accounts = new Set<string>();
  const docs: Record<string, string>[] = [];
  let doc: Record<string, string> | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("СекцияДокумент")) {
      doc = {};
      continue;
    }
    if (line === "КонецДокумента") {
      if (doc) docs.push(doc);
      doc = null;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    const value = line.slice(eq + 1).trim();
    if (doc) doc[key] = value;
    else if (key === "РасчСчет" && value) accounts.add(value);
  }

  const payments: ParsedStatement["payments"] = [];
  let skipped = 0;
  for (const d of docs) {
    const account = d["ПолучательСчет"] ?? "";
    // Входящий: деньги пришли на наш счёт. Если счета в заголовке нет, смотрим на дату поступления
    const incoming = accounts.size ? accounts.has(account) && !accounts.has(d["ПлательщикСчет"] ?? "") : !!d["ДатаПоступило"];
    if (!incoming) continue;
    const date = parseRuDate(d["ДатаПоступило"]) ?? parseRuDate(d["Дата"]);
    const amount = Number((d["Сумма"] ?? "").replace(",", "."));
    if (!date || !Number.isFinite(amount) || amount <= 0) {
      skipped++;
      continue;
    }
    const payerInn = d["ПлательщикИНН"]?.replace(/\D/g, "") || null;
    payments.push({
      account,
      transactionId: statementKey({ account, date, number: d["Номер"] ?? "", amount, payer: payerInn ?? d["ПлательщикСчет"] ?? "" }),
      date,
      amount: Math.round(amount),
      payerName: cleanName(d["Плательщик1"]) ?? cleanName(d["Плательщик"]),
      payerInn,
      purpose: d["НазначениеПлатежа"] || null,
    });
  }
  return { accounts: [...accounts], payments, skipped };
}
