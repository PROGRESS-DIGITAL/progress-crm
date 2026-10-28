import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown } from "../components/markdown-lite";
import { ALL_SCOPES, runTool, scopeOfTool, toolDefinition, toolsFor } from "../lib/agents/tools";

test("агент получает инструменты только открытых разделов", () => {
  const money = toolsFor(["money"]).map((t) => t.name);
  assert.ok(money.includes("revenue_summary"));
  assert.ok(!money.includes("search_deals"));
  const all = toolsFor(ALL_SCOPES).map((t) => t.name);
  assert.equal(new Set(all).size, all.length, "имена инструментов не повторяются");
  assert.equal(scopeOfTool("bank_payments"), "Деньги");
  assert.deepEqual(toolsFor(["unknown"]), []);
});

test("описание инструмента для API: объект со свойствами, без $schema", () => {
  for (const t of toolsFor(ALL_SCOPES)) {
    const def = toolDefinition(t);
    assert.match(def.name, /^[a-z_]+$/);
    assert.ok(def.description.length > 20);
    assert.equal(def.input_schema.type, "object");
    assert.ok(!("$schema" in def.input_schema));
  }
  const revenue = toolDefinition(toolsFor(["money"])[0]);
  assert.deepEqual(Object.keys(revenue.input_schema.properties as object), ["from", "to"]);
});

test("неверные параметры и чужой инструмент возвращаются агенту как ошибка", async () => {
  const tools = toolsFor(["money"]);
  const bad = await runTool(tools, "revenue_summary", { from: "1 октября" });
  assert.equal(bad.ok, false);
  assert.match(bad.content, /Неверные параметры: from/);
  const foreign = await runTool(tools, "search_deals", {});
  assert.equal(foreign.ok, false);
  assert.match(foreign.content, /недоступен/);
});

test("markdown ответа: абзацы, списки и таблица", () => {
  const blocks = parseMarkdown(
    "Выручка за октябрь:\n- **Банк:** 1 240 000 ₽\n- **CRM:** 1 180 000 ₽\n\n| Месяц | Банк |\n|---|---:|\n| Сентябрь | 900 000 ₽ |\n| Октябрь | 1 240 000 ₽ |\n\n1. первое\n2. второе",
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["p", "ul", "table", "ol"],
  );
  const table = blocks[2] as { head: string[]; rows: string[][] };
  assert.deepEqual(table.head, ["Месяц", "Банк"]);
  assert.deepEqual(table.rows[1], ["Октябрь", "1 240 000 ₽"]);
});
