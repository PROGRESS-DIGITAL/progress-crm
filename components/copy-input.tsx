"use client";

import { useRef, useState } from "react";

// Обёртка поля с кнопкой «Скопировать» справа: копирует то, что сейчас в поле, в том числе несохранённую правку
export function CopyInput({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const value = box.current?.querySelector<HTMLInputElement>("input")?.value.trim() ?? "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Без HTTPS буфер обмена недоступен: копируем через выделение
      const el = box.current?.querySelector<HTMLInputElement>("input");
      el?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div ref={box} className="relative min-w-0 flex-1 [&>input]:pr-10">
      {children}
      <button
        type="button"
        onClick={copy}
        title={copied ? "Скопировано" : "Скопировать"}
        aria-label={copied ? "Скопировано" : "Скопировать"}
        className={`absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg ${
          copied ? "text-emerald-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
