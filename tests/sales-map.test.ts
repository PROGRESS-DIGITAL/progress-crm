import { test } from "node:test";
import assert from "node:assert/strict";
import { clientPlan, NEXT_STEPS, SITUATION_OFFERS, STEP_KEYS } from "../lib/sales-map";

test("новому клиенту без сделок предлагаем шаги его ситуации", () => {
  assert.deepEqual(clientPlan([]).next, ["research", "naming"]);
  assert.deepEqual(clientPlan([], "noLogo").next, ["research", "naming", "logo"]);
  assert.deepEqual(clientPlan([], "hasLogo").next, ["logoPassport", "brandbook", "brandPlatform", "landing", "businessSite", "corporateSite", "shop", "ai"]);
  assert.deepEqual(clientPlan([], "complex").next, ["service", "ai"]);
});

test("клиенту с сайтом — переделка сайта, продвижение, ИИ и сервис, но не логотип и не нейминг", () => {
  const plan = clientPlan([], "hasSite");
  assert.deepEqual(plan.next, ["landing", "businessSite", "corporateSite", "shop", "service", "ai", "promotion", "seo", "context"]);
  for (const s of ["research", "naming", "logo", "logoPassport", "brandbook", "brandPlatform"] as const) assert.ok(!plan.next.includes(s), s);
});

test("после логотипа — паспорт, брендбук, бренд-платформа и сайты; нейминг уже не предлагаем", () => {
  const plan = clientPlan([{ step: "logo", kind: "WON" }]);
  assert.equal(plan.situation, "hasLogo");
  assert.deepEqual(plan.done, ["logo"]);
  assert.deepEqual(plan.next, ["logoPassport", "brandbook", "brandPlatform", "landing", "businessSite", "corporateSite", "shop", "ai"]);
});

test("после интернет-магазина — продвижение, ИИ и сервис; другой сайт и шаг в работе не предлагаются", () => {
  const plan = clientPlan([
    { step: "shop", kind: "WON" },
    { step: "promotion", kind: "OPEN" },
    { step: "seo", kind: "LOST" },
    { step: null, kind: "WON" },
  ]);
  assert.equal(plan.situation, "hasSite");
  assert.deepEqual(plan.inProgress, ["promotion"]);
  assert.deepEqual(plan.next, ["service", "ai", "seo", "context"]);
});

test("брендбук, проданный клиенту с сайтом в виде исключения, не тянет за собой бренд-платформу", () => {
  const plan = clientPlan([{ step: "brandbook", kind: "WON" }], "hasSite");
  assert.equal(plan.situation, "hasSite");
  assert.ok(!plan.next.includes("brandPlatform"));
  assert.ok(plan.next.includes("landing"));
});

test("ситуация, указанная вручную, важнее выведенной, если не отстаёт от покупок", () => {
  assert.equal(clientPlan([{ step: "landing", kind: "WON" }], "complex").situation, "complex");
  assert.equal(clientPlan([{ step: "landing", kind: "WON" }], "hasLogo").situation, "hasSite");
  assert.equal(clientPlan([], "noLogo").situation, "noLogo");
});

test("стрелки и предложения ведут только к существующим шагам", () => {
  for (const [from, to] of Object.entries({ ...NEXT_STEPS, ...SITUATION_OFFERS })) {
    for (const s of to) assert.ok(STEP_KEYS.includes(s), `${from} → ${s}`);
  }
  for (const from of Object.keys(NEXT_STEPS)) assert.ok(STEP_KEYS.includes(from as never));
});
