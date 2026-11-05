import type Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/settings";
import { toolDefinition, type Tool } from "@/lib/agents/tools";

// YandexGPT в Yandex AI Studio: тот же цикл инструментов, что у Claude.
// Запросы идут в OpenAI-совместимый API: в старом Foundation Models API поле tools Яндекс пока игнорирует,
// и модель отвечает, не заглядывая в CRM. История чатов хранится в формате блоков Claude, здесь она переводится туда и обратно
export const YANDEX_KEY_SETTING = "yandex.apiKey";
export const YANDEX_FOLDER_SETTING = "yandex.folderId";
export const YANDEX_MODEL_SETTING = "yandex.model";
export const YANDEX_DEFAULT_MODEL = "yandexgpt-5-lite";
const ENDPOINT = "https://ai.api.cloud.yandex.net/v1/chat/completions";

export type YandexClient = { apiKey: string; folderId: string; model: string };

export async function getYandex(): Promise<YandexClient | null> {
  const [apiKey, folderId, model] = await Promise.all([
    getSetting(YANDEX_KEY_SETTING),
    getSetting(YANDEX_FOLDER_SETTING),
    getSetting(YANDEX_MODEL_SETTING),
  ]);
  if (!apiKey || !folderId) return null;
  return { apiKey, folderId, model: model || YANDEX_DEFAULT_MODEL };
}

export class YandexError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type YMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type Block = Anthropic.Beta.BetaContentBlockParam | Anthropic.Beta.BetaContentBlock;

// Модели Яндекса слабее держат инструменты, поэтому прямо говорим, откуда брать цифры
const TOOLS_HINT =
  "Данные CRM (выручка, сделки, клиенты, задачи, поступления) ты видишь только через инструменты. " +
  "Прежде чем отвечать на вопрос о данных, вызови подходящий инструмент и опирайся на его ответ. " +
  "Не пиши, что данных нет, пока не проверил это инструментом.";

// Блоки Claude → сообщения YandexGPT. Размышления Claude пропускаем
export function toYandexMessages(system: string, messages: Anthropic.Beta.BetaMessageParam[], withTools = true): YMessage[] {
  const out: YMessage[] = [{ role: "system", content: withTools ? `${system}\n\n${TOOLS_HINT}` : system }];
  for (const m of messages) {
    const blocks: Block[] = typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content as Block[]);
    const text = blocks
      .filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text")
      .map((b) => b.text)
      .join("\n\n")
      .trim();
    if (m.role === "assistant") {
      const calls = blocks.filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use");
      if (calls.length)
        out.push({
          role: "assistant",
          content: text || null,
          tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } })),
        });
      else if (text) out.push({ role: "assistant", content: text });
      continue;
    }
    const results = blocks.filter((b): b is Anthropic.Beta.BetaToolResultBlockParam => b.type === "tool_result");
    for (const r of results)
      out.push({ role: "tool", tool_call_id: r.tool_use_id, content: typeof r.content === "string" ? r.content : JSON.stringify(r.content ?? "") });
    if (!results.length && text) out.push({ role: "user", content: text });
  }
  return out;
}

export type Choice = {
  finish_reason?: string | null;
  message?: { role?: string; content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: unknown } }[] };
};

export type YandexReply = { content: Anthropic.Beta.BetaContentBlock[]; stop_reason: "tool_use" | "end_turn" | "refusal" | "max_tokens" };

// Ответ YandexGPT → блоки Claude: так ответ сохраняется в чат и уходит дальше по тому же циклу
export function fromYandex(choice: Choice | undefined, step: number): YandexReply {
  const calls = choice?.message?.tool_calls ?? [];
  const text = choice?.message?.content?.trim() ?? "";
  const textBlocks = text ? [{ type: "text", text, citations: null }] : [];
  if (calls.length) {
    const content = [
      ...textBlocks,
      ...calls.map((c, i) => ({
        type: "tool_use" as const,
        id: c.id || `yc_${step}_${i}`,
        name: c.function?.name ?? "",
        input: typeof c.function?.arguments === "string" ? safeJson(c.function.arguments) : (c.function?.arguments ?? {}),
      })),
    ];
    return { content: content as unknown as Anthropic.Beta.BetaContentBlock[], stop_reason: "tool_use" };
  }
  const content = textBlocks as unknown as Anthropic.Beta.BetaContentBlock[];
  if (choice?.finish_reason === "content_filter") return { content, stop_reason: "refusal" };
  if (choice?.finish_reason === "length") return { content, stop_reason: "max_tokens" };
  return { content, stop_reason: "end_turn" };
}

function safeJson(s: string) {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

// Полный адрес модели можно вписать и самому: gpt://каталог/yandexgpt/rc
export const modelUri = (client: YandexClient) => (client.model.startsWith("gpt://") ? client.model : `gpt://${client.folderId}/${client.model}`);

export async function yandexComplete(
  client: YandexClient,
  body: { messages: YMessage[]; tools?: Tool[]; noTools?: boolean; maxTokens?: number },
  timeoutMs = 120_000,
): Promise<Choice | undefined> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${client.apiKey}`,
        "OpenAI-Project": client.folderId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelUri(client),
        temperature: 0.3,
        max_tokens: body.maxTokens ?? 4000,
        messages: body.messages,
        ...(body.tools?.length && {
          tools: body.tools.map((t) => {
            const d = toolDefinition(t);
            return { type: "function", function: { name: d.name, description: d.description, parameters: d.input_schema } };
          }),
          tool_choice: body.noTools ? "none" : "auto",
        }),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new YandexError(0, e instanceof Error ? e.message : String(e));
  }
  const data = (await res.json().catch(() => null)) as { choices?: Choice[]; message?: string; error?: { message?: string } | string } | null;
  if (!res.ok) {
    const err = typeof data?.error === "string" ? data.error : data?.error?.message;
    throw new YandexError(res.status, err ?? data?.message ?? res.statusText);
  }
  return data?.choices?.[0];
}

export function describeYandexError(e: YandexError) {
  if (e.status === 0) return "Нет связи с YandexGPT. Проверьте интернет на сервере.";
  if (e.status === 401) return "YandexGPT не принял ключ. Проверьте его в «Интеграциях» → YandexGPT.";
  if (e.status === 403)
    return "YandexGPT отказал в доступе: у сервисного аккаунта нет роли ai.languageModels.user или неверный идентификатор каталога.";
  if (e.status === 404) return `YandexGPT не нашёл модель: проверьте её название в «Интеграциях» → YandexGPT. ${e.message}`.trim();
  if (e.status === 429) return "Слишком много запросов к YandexGPT или исчерпана квота. Попробуйте через минуту.";
  return `YandexGPT ответил ошибкой ${e.status}: ${e.message}`;
}
