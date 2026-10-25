"use client";

import { useEffect, useRef } from "react";

type Message = { id: string; direction: "IN" | "OUT"; text: string; time: string; author: string | null };

// Лента сообщений; при новом сообщении прокручивается вниз
export function Messages({ messages }: { messages: Message[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.id;
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [last]);

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
          <p className="break-words whitespace-pre-wrap">{m.text}</p>
          <p className={`mt-0.5 text-right text-[11px] ${m.direction === "OUT" ? "text-blue-100" : "text-slate-400"}`}>
            {m.direction === "OUT" && m.author ? `${m.author} · ` : ""}
            {m.time}
          </p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
