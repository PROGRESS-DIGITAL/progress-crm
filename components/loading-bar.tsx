"use client";

import { useEffect, useState } from "react";

const CAPTIONS = ["Подгружаю данные", "Свожу цифры", "Обновляю связки", "Пилим данные"];

// Полоса загрузки CRM: синяя полоска с бегущими голубыми полосами, подписи сменяют друг друга.
// Одна на всё: загрузка раздела, переключение переписки, повтор после сбоя
export function LoadingBar({ className = "" }: { className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div role="status" aria-live="polite" className={`flex w-full flex-col items-center justify-center gap-3 px-4 py-16 ${className}`}>
      <div className="h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-blue-100">
        <div className="load-stripes h-full w-full rounded-full" />
      </div>
      <p key={n} className="load-caption text-sm font-medium text-slate-500">
        {CAPTIONS[n % CAPTIONS.length]}…
      </p>
    </div>
  );
}
