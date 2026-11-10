import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeStatement, parseStatement1C, StatementError } from "../lib/finance/statement-1c";
import { authorizeUrl, incomingPayments } from "../lib/finance/sber";

const FILE = `1CClientBankExchange
ВерсияФормата=1.03
Кодировка=Windows
Отправитель=СберБизнес
ДатаНачала=01.11.2026
ДатаКонца=10.11.2026
РасчСчет=40702810938000000001
СекцияРасчСчет
РасчСчет=40702810938000000001
НачальныйОстаток=1000.00
КонецРасчСчет
СекцияДокумент=Платежное поручение
Номер=245
Дата=05.11.2026
Сумма=50000.00
ПлательщикСчет=40702810100000000777
Плательщик=ИНН 7701234567 ООО "Ромашка"
ПлательщикИНН=7701234567
Плательщик1=ООО "Ромашка"
ПолучательСчет=40702810938000000001
ДатаПоступило=06.11.2026
Получатель1=ООО "Прогресс"
НазначениеПлатежа=Оплата по счету № 12 от 01.11.2026. Без НДС
КонецДокумента
СекцияДокумент=Платежное поручение
Номер=17
Дата=07.11.2026
Сумма=3000.00
ПлательщикСчет=40702810938000000001
ПолучательСчет=40702810500000000999
ДатаСписано=07.11.2026
НазначениеПлатежа=Аренда
КонецДокумента
СекцияДокумент=Банковский ордер
Номер=9
Дата=08.11.2026
Сумма=1234,56
ПлательщикСчет=30101810400000000225
Плательщик=ИП Иванов Иван Иванович//р/с 4080…//
ПлательщикИНН=500100732259
ПолучательСчет=40702810938000000001
ДатаПоступило=08.11.2026
НазначениеПлатежа=За продвижение
КонецДокумента
КонецФайла
`;

test("выписка 1С: только поступления на свой счёт", () => {
  const r = parseStatement1C(FILE);
  assert.deepEqual(r.accounts, ["40702810938000000001"]);
  assert.equal(r.payments.length, 2);
  const [a, b] = r.payments;
  assert.equal(a.amount, 50000);
  assert.equal(a.payerName, 'ООО "Ромашка"');
  assert.equal(a.payerInn, "7701234567");
  assert.equal(a.date.toISOString(), "2026-11-06T09:00:00.000Z");
  assert.match(a.purpose ?? "", /счету № 12/);
  assert.equal(b.amount, 1235);
  assert.equal(b.payerName, "ИП Иванов Иван Иванович");
  assert.notEqual(a.transactionId, b.transactionId);
});

test("выписка 1С в Windows-1251 читается", () => {
  const enc = new Uint8Array([0xd1, 0xe1, 0xe5, 0xf0]); // «Сбер» в 1251
  assert.equal(decodeStatement(enc), "Сбер");
  assert.equal(decodeStatement(new TextEncoder().encode("Сбер")), "Сбер");
});

test("не выписка 1С — понятная ошибка", () => {
  assert.throws(() => parseStatement1C("Дата;Сумма\n"), StatementError);
});

test("платёж из API Сбера и из файла получает один ключ", () => {
  const file = parseStatement1C(FILE).payments[0];
  const [api] = incomingPayments("40702810938000000001", [
    {
      uuid: "c0a8",
      number: "245",
      direction: "CREDIT",
      operationDate: "2026-11-06T00:00:00",
      amountRub: { amount: 50000 },
      paymentPurpose: "Оплата по счету № 12 от 01.11.2026. Без НДС",
      rurTransfer: { payerName: 'ООО "Ромашка"', payerInn: "7701234567", payerAccount: "40702810100000000777" },
    },
    { number: "17", direction: "DEBIT", operationDate: "2026-11-07", amountRub: { amount: 3000 } },
  ]);
  assert.equal(api.transactionId, file.transactionId);
  assert.equal(api.payerInn, "7701234567");
  assert.equal(api.date.toISOString(), file.date.toISOString());
});

test("ссылка входа в СберБизнес", () => {
  const u = new URL(authorizeUrl({ clientId: "123", redirectUri: "https://crm.progrs.ru/integrations/sber/callback" }, "s", "n"));
  assert.equal(u.host, "sbi.sberbank.ru:9443");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("redirect_uri"), "https://crm.progrs.ru/integrations/sber/callback");
  assert.match(u.searchParams.get("scope") ?? "", /^openid /);
});
