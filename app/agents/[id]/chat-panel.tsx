"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { MarkdownLite } from "@/components/markdown-lite";
import { useEnterToSend } from "@/components/enter-to-send";
import { askAgentAction } from "../actions";

type Message = { id: string; role: "user" | "assistant"; text: string; sources: string[]; time: string };

// Чат с агентом: вопрос сразу появляется в ленте, пока агент смотрит данные и пишет ответ
export function ChatPanel({
  agentId,
  agentName,
  chatId,
  hasKey,
  suggestions,
  messages,
}: {
  agentId: string;
  agentName: string;
  chatId: string | null;
  hasKey: boolean;
  suggestions: string[];
  messages: Message[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asked, setAsked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Ответ пришёл с сервера: временный вопрос больше не нужен
  const count = messages.length;
  useEffect(() => setAsked(null), [count]);
  useEffect(() => {
    if (count || asked) endRef.current?.scrollIntoView({ block: "end" });
  }, [count, asked]);

  function ask(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    setError(null);
    setAsked(text);
    setDraft("");
    startTransition(async () => {
      const res = await askAgentAction(agentId, chatId, text);
      if (!res.ok) {
        setAsked(null);
        setDraft(text);
        setError(res.error);
        return;
      }
      if (res.chatId !== chatId) router.replace(`/agents/${agentId}?chat=${res.chatId}`, { scroll: false });
      else router.refresh();
    });
  }

  const enter = useEnterToSend(textRef, () => ask(draft));
  const empty = messages.length === 0 && !asked;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-5">
        {empty && (
          <div className="m-auto flex w-full max-w-lg flex-col items-center gap-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/30">
              <Icon name="spark" size={22} />
            </span>
            <div>
              <p className="font-semibold">{agentName}</p>
              <p className="mt-1 text-sm text-slate-500">Спросите о выручке, сделках, клиентах или задачах. Агент посмотрит данные CRM и ответит.</p>
            </div>
            {hasKey && suggestions.length > 0 && (
              <div className="flex w-full flex-col gap-2 sm:grid sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <Bubble key={m.id} mine time={m.time}>
              <p className="break-words whitespace-pre-wrap">{m.text}</p>
            </Bubble>
          ) : (
            <Bubble key={m.id} time={m.time} sources={m.sources}>
              <MarkdownLite text={m.text} />
            </Bubble>
          ),
        )}
        {asked && (
          <>
            <Bubble mine>
              <p className="break-words whitespace-pre-wrap">{asked}</p>
            </Bubble>
            <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm text-slate-500 shadow-sm">
              <span className="flex gap-1" aria-hidden>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              Смотрю данные CRM…
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-slate-100 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        {!hasKey && (
          <p className="mb-2 text-xs text-amber-800">
            Чтобы агент заработал, подключите Claude в{" "}
            <Link href="/integrations/claude" className="font-medium underline">
              «Интеграциях»
            </Link>
            .
          </p>
        )}
        {error && (
          <p role="alert" className="mb-2 text-xs text-rose-600">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            placeholder={hasKey ? "Спросите агента" : "Агент не подключён"}
            aria-label="Вопрос агенту"
            disabled={!hasKey}
            {...enter}
            className="max-h-40 min-h-11 w-full min-w-0 flex-1 resize-none rounded-2xl border border-transparent bg-slate-100 px-4 py-2.5 text-base outline-none [field-sizing:content] focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60 sm:text-sm"
          />
          <button
            type="submit"
            disabled={pending || !hasKey || !draft.trim()}
            aria-label="Отправить"
            title="Отправить (Enter)"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-60"
          >
            <Icon name="arrowRight" size={20} />
          </button>
        </div>
      </form>
    </>
  );
}

function Bubble({ mine, time, sources, children }: { mine?: boolean; time?: string; sources?: string[]; children: React.ReactNode }) {
  return (
    <div
      className={`max-w-[92%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[80%] ${
        mine ? "self-end rounded-br-md bg-blue-600 text-white" : "self-start rounded-bl-md bg-white text-slate-900"
      }`}
    >
      {children}
      {(time || sources?.length) && (
        <p className={`mt-1 text-[11px] ${mine ? "text-right text-blue-100" : "text-slate-400"}`}>
          {sources?.length ? `Разделы: ${sources.join(", ")}` : ""}
          {sources?.length && time ? " · " : ""}
          {time}
        </p>
      )}
    </div>
  );
}
