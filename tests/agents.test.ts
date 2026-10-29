import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown } from "../components/markdown-lite";
import { normalizeWebsite, pageText } from "../lib/agents/website";
import { aiOn, isTyping, plainText } from "../lib/agents/client-chat";
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

test("AI в чатах: включён в переписке, если выбран агент и нет ручного запрета", () => {
  const on = { agentId: "a1", defaultOn: true };
  const off = { agentId: "a1", defaultOn: false };
  const chat = (aiEnabled: boolean | null) => ({ aiEnabled, channel: "TELEGRAM" as const, externalId: "42" });
  assert.equal(aiOn(chat(null), on), true);
  assert.equal(aiOn(chat(null), off), false);
  assert.equal(aiOn(chat(true), off), true);
  assert.equal(aiOn(chat(false), on), false);
  assert.equal(aiOn(chat(true), { agentId: null, defaultOn: true }), false);
  // Свой чат с ботом напоминаний: «во всех переписках» его не включает, ручной переключатель включает
  assert.equal(aiOn(chat(null), on, "42"), false);
  assert.equal(aiOn(chat(true), on, "42"), true);
});

test("AI в чатах: в мессенджер уходит текст без markdown", () => {
  assert.equal(plainText("## Цены\nСайт стоит **от 90 000 ₽**.  "), "Цены\nСайт стоит от 90 000 ₽.");
  assert.equal(plainText("x".repeat(5000)).length, 4000);
  assert.equal(plainText("Примеры: [портфолио](https://progrs.ru/cases). Пишите на [почту](mailto:a@b.ru)"), "Примеры: портфолио: https://progrs.ru/cases. Пишите на почту: a@b.ru");
  assert.equal(plainText("[https://progrs.ru](https://progrs.ru)"), "https://progrs.ru");
});

test("раздел «Изменения в CRM» даёт агенту инструменты, которые меняют данные", () => {
  const edit = toolsFor(["edit"]).map((t) => t.name);
  assert.deepEqual(edit, ["create_lead", "create_client", "create_deal", "move_deal", "create_event"]);
  assert.equal(scopeOfTool("move_deal"), "Изменения в CRM");
  assert.ok(!toolsFor(["money", "sales"]).some((t) => t.name.startsWith("create_")), "без раздела агент ничего не меняет");
  for (const t of toolsFor(["edit"])) assert.equal(toolDefinition(t).input_schema.type, "object");
});

test("«печатает…» гаснет, если ответ так и не пришёл", () => {
  const now = Date.now();
  assert.equal(isTyping({ aiTypingAt: null }, now), false);
  assert.equal(isTyping({ aiTypingAt: new Date(now - 5_000) }, now), true);
  assert.equal(isTyping({ aiTypingAt: new Date(now - 5 * 60_000) }, now), false);
});

test("сайт агента: адрес из формы приводится к https и проверяется", () => {
  assert.equal(normalizeWebsite("progrs.ru"), "https://progrs.ru/");
  assert.equal(normalizeWebsite(" https://progrs.ru/uslugi#top "), "https://progrs.ru/uslugi");
  assert.equal(normalizeWebsite(""), null);
  assert.equal(normalizeWebsite("ftp://progrs.ru"), undefined);
  assert.equal(normalizeWebsite("просто текст"), undefined);
});

test("сайт агента: из страницы остаются текст и ссылки только этого сайта", () => {
  const html = `<html><head><title>Студия &laquo;Прогресс&raquo;</title><meta name="description" content="Сайты и SEO"><style>.a{}</style></head>
    <body><script>alert(1)</script><h1>Услуги</h1><p>Лендинг&nbsp;от 150 000 ₽</p>
    <a href="/uslugi">Услуги</a><a href="https://www.progrs.ru/kejsy#x">Кейсы</a><a href="https://evil.example/">Чужой</a></body></html>`;
  const page = pageText(html, new URL("https://progrs.ru/"));
  assert.equal(page.title, "Студия «Прогресс»");
  assert.equal(page.description, "Сайты и SEO");
  assert.equal(page.text, "Услуги\nЛендинг от 150 000 ₽\nУслуги Кейсы Чужой");
  assert.deepEqual(page.links, ["/uslugi", "/kejsy"]);
});

test("ссылки в тексте сообщений: адрес без точки в конце, почта и www", async () => {
  const { splitLinks } = await import("../components/linkify");
  assert.deepEqual(splitLinks("Смотрите https://progrs.ru/cases. Или www.ya.ru, пишите a@b.ru!"), [
    { text: "Смотрите " },
    { text: "https://progrs.ru/cases", href: "https://progrs.ru/cases" },
    { text: ". Или " },
    { text: "www.ya.ru", href: "https://www.ya.ru" },
    { text: ", пишите " },
    { text: "a@b.ru", href: "mailto:a@b.ru" },
    { text: "!" },
  ]);
  assert.deepEqual(splitLinks("без ссылок"), [{ text: "без ссылок" }]);
});
