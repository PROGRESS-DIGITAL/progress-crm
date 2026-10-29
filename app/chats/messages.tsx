"use client";

import { useEffect, useRef } from "react";
import { Linkify } from "@/components/linkify";

type Message = { id: string; direction: "IN" | "OUT"; text: string; time: string; author: string | null };

// Лента сообщений; при новом сообщении прокручивается вниз
export function Messages({ messages, typing }: { messages: Message[]; typing?: string | null }) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.id;
  // Фигурные скобки нужны: в новых Chrome scrollIntoView возвращает Promise, и React принял бы его
  // за функцию очистки эффекта и упал с «is not a function» при смене переписки
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [last, typing]);

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-5">
      {messages.length === 0 && <p className="m-auto text-sm text-slate-500">Сообщений пока нет</p>}
      {messages.map((m) => (
        <div
          key={m.id}
          className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${
            m.direction === "OUT" ? "self-end rounded-br-md bg-blue-600 text-white" : "self-start rounded-bl-md bg-white text-slate-900"
          }`}
        >
          <p className="break-words whitespace-pre-wrap">
            <Linkify
              text={m.text}
              className={`underline underline-offset-2 ${m.direction === "OUT" ? "text-white" : "text-blue-700 hover:text-blue-800"}`}
            />
          </p>
          <p className={`mt-0.5 text-right text-[11px] ${m.direction === "OUT" ? "text-blue-100" : "text-slate-400"}`}>
            {m.direction === "OUT" && m.author ? `${m.author} · ` : ""}
            {m.time}
          </p>
        </div>
      ))}
      {typing && (
        <div className="flex items-center gap-2 self-end rounded-2xl rounded-br-md bg-blue-50 px-3.5 py-2 text-sm text-blue-700" aria-live="polite">
          <span className="flex gap-1" aria-hidden>
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
          {typing} печатает…
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
