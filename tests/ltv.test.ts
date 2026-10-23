import { test } from "node:test";
import assert from "node:assert/strict";
import { clientLtv, rankClients } from "../lib/ltv";

const won = (amount: number) => ({ amount, stage: { kind: "WON" as const } });
const open = (amount: number) => ({ amount, stage: { kind: "OPEN" as const } });
const lost = (amount: number) => ({ amount, stage: { kind: "LOST" as const } });

test("LTV считает только оплаченные сделки, открытые идут отдельно", () => {
  const row = clientLtv({ id: "1", name: "А", deals: [won(100), won(300), open(50), lost(999)] });
  assert.equal(row.ltv, 400);
  assert.equal(row.paidDeals, 2);
  assert.equal(row.avgCheck, 200);
  assert.equal(row.open, 50);
  assert.equal(row.openDeals, 1);
});

test("клиент без оплат: LTV и средний чек нулевые", () => {
  const row = clientLtv({ id: "1", name: "А", deals: [open(10)] });
  assert.equal(row.ltv, 0);
  assert.equal(row.avgCheck, 0);
});

test("сортирует по LTV, затем по сумме в работе", () => {
  const rows = rankClients([
    clientLtv({ id: "1", name: "Б", deals: [open(10)] }),
    clientLtv({ id: "2", name: "А", deals: [won(5)] }),
    clientLtv({ id: "3", name: "В", deals: [open(20)] }),
  ]);
  assert.deepEqual(rows.map((r) => r.name), ["А", "В", "Б"]);
});
