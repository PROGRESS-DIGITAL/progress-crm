import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceNumberFromPurpose, matchInvoice } from "../lib/finance/matching";
import { actBody, incomingPayments, invoiceBody, ndsIncluded } from "../lib/finance/tochka";
import { companyFromOrganization, draftMessage } from "../lib/finance/diadoc";

const account = { accountId: "40702810000000000001/044525104", customerCode: "300000001", name: "40702810000000000001" };

test("номер счёта из назначения платежа", () => {
  assert.equal(invoiceNumberFromPurpose("Оплата по счету № 12 от 26.10.2026 за сайт. Без НДС"), 12);
  assert.equal(invoiceNumberFromPurpose("Оплата по сч.№7"), 7);
  assert.equal(invoiceNumberFromPurpose("Оплата по счёту 15 от 01.10"), 15);
  assert.equal(invoiceNumberFromPurpose("Оплата за услуги"), null);
});

test("платёж находит свой счёт", () => {
  const open = [
    { id: "a", seq: 3, amount: 50000, inn: "7701234567", date: new Date("2026-10-01") },
    { id: "b", seq: 4, amount: 50000, inn: "7701234567", date: new Date("2026-10-05") },
    { id: "c", seq: 5, amount: 90000, inn: "500100732259", date: new Date("2026-10-06") },
  ];
  // По номеру из назначения
  assert.equal(matchInvoice({ amount: 50000, payerInn: "7701234567", purpose: "Оплата по счету № 4" }, open), "b");
  // Без номера: самый ранний счёт этого ИНН на ту же сумму
  assert.equal(matchInvoice({ amount: 50000, payerInn: "7701234567", purpose: "За сайт" }, open), "a");
  // Чужой номер с другой суммой и ИНН не подходит
  assert.equal(matchInvoice({ amount: 1000, payerInn: "1234567890", purpose: "счет № 5" }, open), null);
  // Сумма не совпала — не угадываем
  assert.equal(matchInvoice({ amount: 45000, payerInn: "7701234567", purpose: null }, open), null);
});

test("НДС внутри суммы", () => {
  assert.equal(ndsIncluded(120000, "nds_20"), 20000);
  assert.equal(ndsIncluded(100000, "without_nds"), 0);
  assert.equal(ndsIncluded(1000, "nds_5"), 47.62);
});

test("счёт для Точки", () => {
  const body = invoiceBody({
    account,
    party: { inn: "500100732259", kpp: null, name: "ИП Петров", address: null },
    number: "12",
    date: "2026-10-26",
    title: "Бизнес-сайт",
    amount: 250000,
    nds: "without_nds",
  });
  assert.deepEqual(body, {
    Data: {
      accountId: account.accountId,
      customerCode: "300000001",
      SecondSide: { taxCode: "500100732259", type: "ip", secondSideName: "ИП Петров" },
      Content: {
        Invoice: {
          Positions: [
            { positionName: "Бизнес-сайт", unitCode: "услуга.", ndsKind: "without_nds", price: 250000, quantity: 1, totalAmount: 250000 },
          ],
          date: "2026-10-26",
          totalAmount: 250000,
          number: "12",
        },
      },
    },
  });
});

test("акт ссылается на счёт и считает НДС", () => {
  const body = actBody(
    {
      account,
      party: { inn: "7701234567", kpp: "770101001", name: "ООО Ромашка", address: "Москва" },
      number: "3",
      date: "2026-10-26",
      title: "SEO",
      amount: 60000,
      nds: "nds_20",
    },
    "inv-1",
  );
  assert.equal(body.Data.documentId, "inv-1");
  assert.equal(body.Data.SecondSide.type, "company");
  assert.equal(body.Data.SecondSide.kpp, "770101001");
  assert.equal(body.Data.Content.Act.totalNds, 10000);
});

test("из выписки берём только поступления", () => {
  const p = incomingPayments([
    {
      transactionId: "t1",
      creditDebitIndicator: "Credit",
      documentProcessDate: "2026-10-20",
      description: "Оплата по счету № 1",
      Amount: { amount: 50000 },
      DebtorParty: { inn: "7701234567", name: "ООО Ромашка" },
    },
    { transactionId: "t2", creditDebitIndicator: "Debit", Amount: { amount: 100 } },
  ]);
  assert.equal(p.length, 1);
  assert.equal(p[0].payerInn, "7701234567");
  assert.equal(p[0].amount, 50000);
});

test("контрагент Диадока превращается в клиента", () => {
  const c = companyFromOrganization({
    Inn: "7701234567",
    Kpp: "770101001",
    FullName: "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «РОМАШКА»",
    ShortName: "ООО «Ромашка»",
    Ogrn: "1027700000000",
    Address: { RussianAddress: { ZipCode: "101000", City: "Москва", Street: "ул Мясницкая", Building: "1" } },
    Boxes: [{ BoxId: "box-1" }],
  });
  assert.deepEqual(c, {
    name: "ООО «Ромашка»",
    inn: "7701234567",
    kpp: "770101001",
    ogrn: "1027700000000",
    address: "101000, Москва, ул Мясницкая, д 1",
    boxId: "box-1",
  });
});

test("акт уходит в Диадок черновиком с запросом подписи", () => {
  const m = draftMessage("from", "to", Buffer.from("%PDF"), { fileName: "Акт № 1.pdf", number: "1", date: "26.10.2026", comment: "c" });
  assert.equal(m.IsDraft, true);
  assert.equal(m.DocumentAttachments[0].SignedContent.Content, Buffer.from("%PDF").toString("base64"));
  assert.equal(m.DocumentAttachments[0].NeedRecipientSignature, true);
});
