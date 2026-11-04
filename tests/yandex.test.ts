import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod/v4";
import { fromYandex, toYandexMessages } from "../lib/agents/yandex";
import { runEngineLoop } from "../lib/agents/agent";
import { tool } from "../lib/agents/tool";

test("история Claude переводится в сообщения YandexGPT, размышления пропускаются", () => {
  const out = toYandexMessages("Система", [
    { role: "user", content: [{ type: "text", text: "Сколько выручки?" }] },
    {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "…", signature: "s" },
        { type: "tool_use", id: "t1", name: "revenue_summary", input: { period: "month" } },
      ],
    },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: '{"sum":100}' }] },
    { role: "assistant", content: [{ type: "text", text: "100 ₽" }] },
  ]);
  assert.deepEqual(out, [
    { role: "system", text: "Система" },
    { role: "user", text: "Сколько выручки?" },
    { role: "assistant", toolCallList: { toolCalls: [{ functionCall: { name: "revenue_summary", arguments: { period: "month" } } }] } },
    { role: "user", toolResultList: { toolResults: [{ functionResult: { name: "revenue_summary", content: '{"sum":100}' } }] } },
    { role: "assistant", text: "100 ₽" },
  ]);
});

test("ответ YandexGPT превращается в блоки: вызов инструмента или текст", () => {
  const call = fromYandex(
    { status: "ALTERNATIVE_STATUS_TOOL_CALLS", message: { toolCallList: { toolCalls: [{ functionCall: { name: "x", arguments: { a: 1 } } }] } } },
    2,
  );
  assert.equal(call.stop_reason, "tool_use");
  assert.deepEqual(call.content, [{ type: "tool_use", id: "yc_2_0", name: "x", input: { a: 1 } }]);
  const text = fromYandex({ status: "ALTERNATIVE_STATUS_FINAL", message: { text: " Готово " } }, 0);
  assert.equal(text.stop_reason, "end_turn");
  assert.deepEqual(text.content, [{ type: "text", text: "Готово", citations: null }]);
  assert.equal(fromYandex({ status: "ALTERNATIVE_STATUS_CONTENT_FILTER", message: { text: "" } }, 0).stop_reason, "refusal");
});

test("агент на YandexGPT сходил за данными и ответил", async () => {
  const bodies: { messages: { role: string }[]; toolChoice?: unknown; tools?: unknown[] }[] = [];
  const replies = [
    { status: "ALTERNATIVE_STATUS_TOOL_CALLS", message: { role: "assistant", toolCallList: { toolCalls: [{ functionCall: { name: "echo", arguments: { word: "привет" } } }] } } },
    { status: "ALTERNATIVE_STATUS_FINAL", message: { role: "assistant", text: "Инструмент сказал: привет" } },
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: { body: string; headers: Record<string, string> }) => {
    assert.equal(init.headers.Authorization, "Api-Key key");
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ result: { alternatives: [replies[bodies.length - 1]] } }));
  }) as unknown as typeof fetch;
  try {
    const echo = tool({ name: "echo", description: "Повторяет слово", schema: z.object({ word: z.string() }), run: async ({ word }) => ({ word }) });
    const r = await runEngineLoop(
      { engine: "yandex", client: { apiKey: "key", folderId: "b1gfolder", model: "yandexgpt-5-lite" } },
      { system: "s", tools: [echo], messages: [{ role: "user", content: [{ type: "text", text: "скажи" }] }], effort: "low", maxSteps: 4 },
    );
    assert.equal(r.final.stop_reason, "end_turn");
    assert.equal(r.steps.length, 3);
    assert.equal(bodies[0].tools?.length, 1);
    // Второй запрос несёт вызов и его результат
    assert.deepEqual(bodies[1].messages.map((m) => m.role), ["system", "user", "assistant", "user"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
