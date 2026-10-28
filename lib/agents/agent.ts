import Anthropic from "@anthropic-ai/sdk";
import type { Agent } from "@prisma/client";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { ALL_SCOPES, SCOPES, runTool, scopeOfTool, toolDefinition, toolsFor } from "@/lib/agents/tools";

export const CLAUDE_KEY_SETTING = "claude.apiKey";
export const CLAUDE_URL_SETTING = "claude.baseUrl";
export const CLAUDE_MODEL = "claude-opus-5-5";
export const DEFAULT_BASE_URL = "https://api.anthropic.com";

// Сколько раз за один вопрос агент может сходить за данными, прежде чем обязан ответить
const MAX_STEPS = 10;

export async function getClaude() {
  const [apiKey, baseURL] = await Promise.all([getSetting(CLAUDE_KEY_SETTING), getSetting(CLAUDE_URL_SETTING)]);
  if (!apiKey) return null;
  return new Anthropic({ apiKey, baseURL: baseURL || DEFAULT_BASE_URL, maxRetries: 2, timeout: 120_000 });
}

export const DEFAULT_AGENT = {
  name: "Ассистент CRM",
  description: "Знает все цифры CRM: выручку, банк, сделки, клиентов, задачи и финмодель",
  instructions: "",
};

// Постоянный агент нужен всегда: если его нет, создаём при первом открытии раздела
export async function ensureDefaultAgent() {
  const existing = await db.agent.findFirst({ where: { isDefault: true } });
  return existing ?? db.agent.create({ data: { ...DEFAULT_AGENT, scopes: ALL_SCOPES, isDefault: true } });
}

const BASE_PROMPT = `Ты AI-агент внутри CRM веб-студии PROGRESS Digital (progrs.ru): сайты, SEO, брендинг, Яндекс Директ. С тобой говорит владелец студии.

Как работать:
- Цифры бери только из инструментов. Не придумывай и не округляй «на глаз»: если данных нет или раздел тебе недоступен, так и скажи.
- Когда спрашивают про выручку, называй обе цифры: поступления по банку (выписка Точки, по дате зачисления) и выручку по CRM (оплаченные сделки по дате закрытия). Если они заметно расходятся, коротко объясни возможную причину.
- Если период не назван, считай текущий месяц по сегодняшний день и скажи об этом.
- Ты только читаешь данные и ничего не меняешь в CRM. Если просят что-то изменить, скажи, что пока умеешь только смотреть и считать, и подскажи, где это сделать в CRM.

Как отвечать:
- По-русски, коротко: сначала ответ, потом детали, если они нужны.
- Суммы в рублях с пробелами между разрядами: 1 234 567 ₽. Даты как «28 октября».
- Можно **жирный**, списки через «- » и простые таблицы markdown. Без заголовков и без эмодзи.`;

function systemPrompt(agent: Agent) {
  const scopes = SCOPES.filter((s) => agent.scopes.includes(s.key));
  const parts = [
    BASE_PROMPT,
    `Тебя зовут «${agent.name}».${agent.description ? ` Твоя роль: ${agent.description}.` : ""}`,
    `Разделы CRM, которые тебе открыты: ${scopes.map((s) => `${s.label} (${s.hint.toLowerCase()})`).join("; ") || "никакие"}.`,
  ];
  if (agent.instructions.trim()) parts.push(`Инструкции владельца:\n${agent.instructions.trim()}`);
  return parts.join("\n\n");
}

function nowLine() {
  const now = new Date();
  const date = now.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });
  return `Сейчас ${date}, ${time} по Москве.`;
}

type Step = { role: "user" | "assistant"; content: Anthropic.Beta.BetaContentBlockParam[] | Anthropic.Beta.BetaContentBlock[]; text: string | null; sources: string[] };

export type AskResult = { ok: true; steps: Step[] } | { ok: false; error: string };

const textOf = (content: Anthropic.Beta.BetaContentBlock[]) =>
  content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();

// Один вопрос владельца: модель ходит за данными, пока не соберёт ответ. История передаётся как есть,
// без правок, а новые шаги возвращаются целиком: их сохраняют только если ответ получен
export async function askAgent(agent: Agent, history: Anthropic.Beta.BetaMessageParam[], question: string): Promise<AskResult> {
  const client = await getClaude();
  if (!client) return { ok: false, error: "Не подключён Claude: добавьте ключ в «Интеграциях»." };

  const tools = toolsFor(agent.scopes);
  const steps: Step[] = [{ role: "user", content: [{ type: "text", text: question }], text: question, sources: [] }];
  const used = new Set<string>();
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: [{ type: "text", text: question }] }];

  try {
    for (let step = 0; ; step++) {
      const last = step >= MAX_STEPS;
      const response = await client.beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        system: [
          { type: "text", text: systemPrompt(agent) },
          { type: "text", text: nowLine() },
        ],
        tools: tools.map(toolDefinition),
        // На последнем шаге данные больше не запрашиваются: агент отвечает тем, что уже собрал
        ...(last ? { tool_choice: { type: "none" as const } } : {}),
        messages,
      });

      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason !== "tool_use" || !toolUses.length) {
        const text =
          response.stop_reason === "refusal"
            ? "На этот вопрос я ответить не могу. Попробуйте переформулировать."
            : textOf(response.content) || "Не получилось собрать ответ. Попробуйте уточнить вопрос.";
        steps.push({ role: "assistant", content: response.content, text, sources: [...used] });
        return { ok: true, steps };
      }

      steps.push({ role: "assistant", content: response.content, text: null, sources: [] });
      const results = await Promise.all(
        toolUses.map(async (b) => {
          const r = await runTool(tools, b.name, b.input);
          const scope = scopeOfTool(b.name);
          if (r.ok && scope) used.add(scope);
          return { type: "tool_result" as const, tool_use_id: b.id, content: r.content, ...(r.ok ? {} : { is_error: true }) };
        }),
      );
      // Все результаты одним сообщением: так модель продолжает запрашивать данные параллельно
      messages.push({ role: "user", content: results });
      steps.push({ role: "user", content: results, text: null, sources: [] });
    }
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

export function describeError(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return "Claude не принял ключ. Проверьте его в «Интеграциях» → Claude.";
  if (e instanceof Anthropic.PermissionDeniedError)
    return "Claude отказал в доступе. Из России API Anthropic напрямую недоступен: укажите адрес посредника в «Интеграциях» → Claude.";
  if (e instanceof Anthropic.RateLimitError) return "Слишком много запросов к Claude или закончился баланс. Попробуйте через минуту.";
  if (e instanceof Anthropic.APIConnectionError) return "Нет связи с Claude. Проверьте интернет или адрес API в «Интеграциях» → Claude.";
  if (e instanceof Anthropic.APIError) return `Claude ответил ошибкой ${e.status ?? ""}: ${e.message}`.trim();
  return e instanceof Error ? e.message : String(e);
}

// Название нового чата: первые слова вопроса
export function chatTitle(question: string) {
  const t = question.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t;
}
