"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/field";

// Поиск без Enter: список обновляется через паузу в наборе, пустое поле возвращает всех клиентов
export function ClientSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(q: string) {
    setValue(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = q.trim();
      startTransition(() => router.replace(query ? `${pathname}?q=${encodeURIComponent(query)}` : pathname));
    }, 250);
  }

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
      <input
        type="search"
        name="q"
        aria-label="Поиск клиентов"
        value={value}
        onChange={(e) => search(e.target.value)}
        placeholder="Название, ИНН, телефон, контакт"
        autoComplete="off"
        className={`${inputClass} ${pending ? "bg-slate-50" : ""}`}
      />
    </form>
  );
}
