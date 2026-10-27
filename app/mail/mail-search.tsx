"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/field";

// Поиск по письмам на ходу, как в «Клиентах»: папка и ящик сохраняются, открытое письмо закрывается
export function MailSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(q: string) {
    setValue(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params);
      next.delete("m");
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      startTransition(() => router.replace(`${pathname}?${next}`));
    }, 250);
  }

  return (
    <input
      type="search"
      aria-label="Поиск по письмам"
      value={value}
      onChange={(e) => search(e.target.value)}
      placeholder="Поиск: отправитель, тема, текст"
      autoComplete="off"
      className={`${inputClass} ${pending ? "bg-slate-50" : ""}`}
    />
  );
}
