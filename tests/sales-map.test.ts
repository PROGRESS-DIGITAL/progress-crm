import { test } from "node:test";
import assert from "node:assert/strict";
import { clientPlan, NEXT_STEPS, STEP_KEYS } from "../lib/sales-map";

test("новому клиенту без сделок предлагаем первые шаги его ситуации", () => {
  assert.deepEqual(clientPlan([]).next, ["research", "naming"]);
  assert.deepEqual(clientPlan([], "hasLogo").next, ["landing", "businessSite", "corporateSite", "shop"]);
  assert.deepEqual(clientPlan([], "complex").next, ["service", "ai"]);
});

test("после логотипа — паспорт, брендбук и сайты; ситуация становится «есть логотип»", () => {
  const plan = clientPlan([{ step: "logo", kind: "WON" }]);
  assert.equal(plan.situation, "hasLogo");
  assert.deepEqual(plan.done, ["logo"]);
  assert.deepEqual(plan.next, ["logoPassport", "brandbook", "landing", "businessSite", "corporateSite", "shop"]);
});

test("после интернет-магазина — ИИ и продвижение, шаг в работе не предлагается повторно", () => {
  const plan = clientPlan([
    { step: "shop", kind: "WON" },
    { step: "promotion", kind: "OPEN" },
    { step: "seo", kind: "LOST" },
    { step: null, kind: "WON" },
  ]);
  assert.equal(plan.situation, "hasSite");
  assert.deepEqual(plan.inProgress, ["promotion"]);
  assert.deepEqual(plan.next, ["ai"]);
});

test("ситуация, указанная вручную, важнее выведенной по сделкам", () => {
  assert.equal(clientPlan([{ step: "landing", kind: "WON" }], "complex").situation, "complex");
});

test("стрелки ведут только к существующим шагам", () => {
  for (const [from, to] of Object.entries(NEXT_STEPS)) {
    assert.ok(STEP_KEYS.includes(from as never));
    for (const s of to) assert.ok(STEP_KEYS.includes(s), `${from} → ${s}`);
  }
});
