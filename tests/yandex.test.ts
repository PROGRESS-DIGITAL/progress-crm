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
  assert.match((out[0] as { content: string }).content, /^Система\n\n.*инструмент/s);
  assert.deepEqual(out.slice(1), [
    { role: "user", content: "Сколько выручки?" },
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "t1", type: "function", function: { name: "revenue_summary", arguments: '{"period":"month"}' } }],
    },
    { role: "tool", tool_call_id: "t1", content: '{"sum":100}' },
    { role: "assistant", content: "100 ₽" },
  ]);
});

test("ответ YandexGPT превращается в блоки: вызов инструмента или текст", () => {
  const call = fromYandex(
    { finish_reason: "tool_calls", message: { content: "", tool_calls: [{ id: "000_a", function: { name: "x", arguments: '{"a":1}' } }] } },
    2,
  );
  assert.equal(call.stop_reason, "tool_use");
  assert.deepEqual(call.content, [{ type: "tool_use", id: "000_a", name: "x", input: { a: 1 } }]);
  // Без id от Яндекса номер вызова придумываем сами, кривой JSON аргументов не роняет цикл
  const noId = fromYandex({ finish_reason: "tool_calls", message: { tool_calls: [{ function: { name: "x", arguments: "{oops" } }] } }, 3);
  assert.deepEqual(noId.content, [{ type: "tool_use", id: "yc_3_0", name: "x", input: {} }]);
  const text = fromYandex({ finish_reason: "stop", message: { content: " Готово " } }, 0);
  assert.equal(text.stop_reason, "end_turn");
  assert.deepEqual(text.content, [{ type: "text", text: "Готово", citations: null }]);
  assert.equal(fromYandex({ finish_reason: "content_filter", message: { content: "" } }, 0).stop_reason, "refusal");
  assert.equal(fromYandex({ finish_reason: "length", message: { content: "…" } }, 0).stop_reason, "max_tokens");
});

test("агент на YandexGPT сходил за данными и ответил", async () => {
  const bodies: { model: string; messages: { role: string; tool_call_id?: string; content?: string }[]; tool_choice?: unknown; tools?: unknown[] }[] = [];
  const replies = [
    { finish_reason: "tool_calls", message: { role: "assistant", content: "", tool_calls: [{ id: "000_x", type: "function", function: { name: "echo", arguments: '{"word":"привет"}' } }] } },
    { finish_reason: "stop", message: { role: "assistant", content: "Инструмент сказал: привет" } },
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: { body: string; headers: Record<string, string> }) => {
    assert.equal(url, "https://ai.api.cloud.yandex.net/v1/chat/completions");
    assert.equal(init.headers.Authorization, "Api-Key key");
    assert.equal(init.headers["OpenAI-Project"], "b1gfolder");
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [replies[bodies.length - 1]] }));
  }) as unknown as typeof fetch;
  try {
    const echo = tool({ name: "echo", description: "Повторяет слово", schema: z.object({ word: z.string() }), run: async ({ word }) => ({ word }) });
    const r = await runEngineLoop(
      { engine: "yandex", client: { apiKey: "key", folderId: "b1gfolder", model: "yandexgpt-5-lite" } },
      { system: "s", tools: [echo], messages: [{ role: "user", content: [{ type: "text", text: "скажи" }] }], effort: "low", maxSteps: 4 },
    );
    assert.equal(r.final.stop_reason, "end_turn");
    assert.equal(r.steps.length, 3);
    assert.equal(bodies[0].model, "gpt://b1gfolder/yandexgpt-5-lite");
    assert.equal(bodies[0].tools?.length, 1);
    assert.equal(bodies[0].tool_choice, "auto");
    // Второй запрос несёт вызов и его результат с тем же id
    assert.deepEqual(bodies[1].messages.map((m) => m.role), ["system", "user", "assistant", "tool"]);
    assert.equal(bodies[1].messages[3].tool_call_id, "000_x");
    assert.equal(bodies[1].messages[3].content, '{"word":"привет"}');
  } finally {
    globalThis.fetch = realFetch;
  }
});
