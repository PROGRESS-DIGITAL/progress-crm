"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";

// Поиск клиентов в шапке: как в разделе «Клиенты», ищет на ходу без Enter и открывает список найденных
export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = pathname === "/clients" ? (params.get("q") ?? "") : "";
  const [value, setValue] = useState(urlQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Ушли из клиентов или искали в самом разделе — поле в шапке показывает то же, что в адресе
  useEffect(() => {
    if (document.activeElement !== input.current) setValue(urlQuery);
  }, [urlQuery]);

  function search(q: string) {
    setValue(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = q.trim();
      const href = query ? `/clients?q=${encodeURIComponent(query)}` : "/clients";
      // На странице клиентов адрес заменяется, чтобы «Назад» не листал каждую букву
      startTransition(() => (pathname === "/clients" ? router.replace(href) : router.push(href)));
    }, 250);
  }

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="relative hidden w-56 lg:block xl:w-72 2xl:w-96">
      <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
      <input
        ref={input}
        name="q"
        type="search"
        value={value}
        onChange={(e) => search(e.target.value)}
        aria-label="Поиск клиентов"
        placeholder="Найти клиента по названию, ИНН, телефону"
        autoComplete="off"
        className={`h-11 w-full rounded-2xl border border-transparent pr-4 pl-10 text-sm outline-none placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 ${pending ? "bg-slate-50" : "bg-slate-100"}`}
      />
    </form>
  );
}
