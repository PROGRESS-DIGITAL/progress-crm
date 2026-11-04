import type Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/settings";
import { toolDefinition, type Tool } from "@/lib/agents/tools";

// YandexGPT в Yandex AI Studio: тот же цикл инструментов, что у Claude, через Foundation Models API.
// История чатов хранится в формате блоков Claude, поэтому здесь она переводится туда и обратно
export const YANDEX_KEY_SETTING = "yandex.apiKey";
export const YANDEX_FOLDER_SETTING = "yandex.folderId";
export const YANDEX_MODEL_SETTING = "yandex.model";
export const YANDEX_DEFAULT_MODEL = "yandexgpt-5-lite";
const ENDPOINT = "https://ai.api.cloud.yandex.net/foundationModels/v1/completion";

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

type YMessage =
  | { role: "system" | "user" | "assistant"; text: string }
  | { role: "assistant"; toolCallList: { toolCalls: { functionCall: { name: string; arguments: unknown } }[] } }
  | { role: "user"; toolResultList: { toolResults: { functionResult: { name: string; content: string } }[] } };

type Block = Anthropic.Beta.BetaContentBlockParam | Anthropic.Beta.BetaContentBlock;

// Блоки Claude → сообщения YandexGPT. Размышления Claude пропускаем, имя функции для результата берём из вызова
export function toYandexMessages(system: string, messages: Anthropic.Beta.BetaMessageParam[]): YMessage[] {
  const out: YMessage[] = [{ role: "system", text: system }];
  const names = new Map<string, string>();
  for (const m of messages) {
    const blocks: Block[] = typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content as Block[]);
    const text = blocks
      .filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text")
      .map((b) => b.text)
      .join("\n\n")
      .trim();
    if (m.role === "assistant") {
      const calls = blocks.filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use");
      if (calls.length) {
        for (const c of calls) names.set(c.id, c.name);
        out.push({ role: "assistant", toolCallList: { toolCalls: calls.map((c) => ({ functionCall: { name: c.name, arguments: c.input ?? {} } })) } });
      } else if (text) out.push({ role: "assistant", text });
      continue;
    }
    const results = blocks.filter((b): b is Anthropic.Beta.BetaToolResultBlockParam => b.type === "tool_result");
    if (results.length)
      out.push({
        role: "user",
        toolResultList: {
          toolResults: results.map((r) => ({
            functionResult: {
              name: names.get(r.tool_use_id) ?? "tool",
              content: typeof r.content === "string" ? r.content : JSON.stringify(r.content ?? ""),
            },
          })),
        },
      });
    else if (text) out.push({ role: "user", text });
  }
  return out;
}

type Alternative = {
  status?: string;
  message?: { role?: string; text?: string; toolCallList?: { toolCalls?: { functionCall?: { name?: string; arguments?: unknown } }[] } };
};

export type YandexReply = { content: Anthropic.Beta.BetaContentBlock[]; stop_reason: "tool_use" | "end_turn" | "refusal" | "max_tokens" };

// Ответ YandexGPT → блоки Claude: так ответ сохраняется в чат и уходит дальше по тому же циклу
export function fromYandex(alt: Alternative | undefined, step: number): YandexReply {
  const calls = alt?.message?.toolCallList?.toolCalls ?? [];
  if (calls.length) {
    const content = calls.map((c, i) => ({
      type: "tool_use" as const,
      id: `yc_${step}_${i}`,
      name: c.functionCall?.name ?? "",
      input: typeof c.functionCall?.arguments === "string" ? safeJson(c.functionCall.arguments) : (c.functionCall?.arguments ?? {}),
    }));
    return { content: content as unknown as Anthropic.Beta.BetaContentBlock[], stop_reason: "tool_use" };
  }
  const text = alt?.message?.text?.trim() ?? "";
  const content = (text ? [{ type: "text", text, citations: null }] : []) as unknown as Anthropic.Beta.BetaContentBlock[];
  if (alt?.status === "ALTERNATIVE_STATUS_CONTENT_FILTER") return { content, stop_reason: "refusal" };
  if (alt?.status === "ALTERNATIVE_STATUS_TRUNCATED_FINAL") return { content, stop_reason: "max_tokens" };
  return { content, stop_reason: "end_turn" };
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export async function yandexComplete(
  client: YandexClient,
  body: { messages: YMessage[]; tools?: Tool[]; noTools?: boolean; maxTokens?: number },
  timeoutMs = 120_000,
): Promise<Alternative | undefined> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${client.apiKey}`,
        "x-folder-id": client.folderId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        modelUri: `gpt://${client.folderId}/${client.model}`,
        completionOptions: { stream: false, temperature: 0.3, maxTokens: String(body.maxTokens ?? 4000) },
        messages: body.messages,
        ...(body.tools?.length && {
          tools: body.tools.map((t) => {
            const d = toolDefinition(t);
            return { function: { name: d.name, description: d.description, parameters: d.input_schema } };
          }),
          ...(body.noTools && { toolChoice: { mode: "NONE" } }),
        }),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new YandexError(0, e instanceof Error ? e.message : String(e));
  }
  const data = (await res.json().catch(() => null)) as { result?: { alternatives?: Alternative[] }; alternatives?: Alternative[]; message?: string; error?: { message?: string } } | null;
  if (!res.ok) throw new YandexError(res.status, data?.error?.message ?? data?.message ?? res.statusText);
  return (data?.result?.alternatives ?? data?.alternatives)?.[0];
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
