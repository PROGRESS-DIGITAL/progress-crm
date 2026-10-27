import os from "node:os";
import { Suspense } from "react";
import Link from "next/link";
import { getOwner } from "@/lib/profile";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderClock } from "@/components/header-clock";
import { HeaderSearch } from "@/components/header-search";
import type { Theme } from "@/components/theme-cookie";

function greeting(now: Date) {
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Moscow" }));
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

// Верхняя панель: приветствие, часы, поиск клиентов, новые лиды и карточка владельца
export async function TopBar({ newLeads, theme }: { newLeads: number; theme: Theme }) {
  const owner = await getOwner();
  const firstName = owner.name.split(/\s+/)[0];
  return (
    <header className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-card sm:min-h-16 sm:gap-4 sm:rounded-3xl sm:px-5 sm:py-3">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold tracking-tight sm:text-lg">
          {greeting(new Date())}, {firstName}!
        </p>
        <p className="hidden truncate text-xs text-slate-500 sm:block">Сделки, клиенты и выручка PROGRESS Digital</p>
      </div>
      <ThemeToggle initial={theme} />

      <div className="ml-auto flex shrink-0 items-center gap-5">
        {/* os.uptime — сколько работает компьютер, на котором запущена CRM */}
        <HeaderClock serverNow={Date.now()} uptime={Math.round(os.uptime())} />
        <Suspense>
          <HeaderSearch />
        </Suspense>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/leads"
          title={newLeads ? `Новых лидов: ${newLeads}` : "Лиды"}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <Icon name="bell" />
          {newLeads > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
              {newLeads}
            </span>
          )}
        </Link>
        <Link
          href="/profile"
          title="Личные данные"
          className="flex items-center gap-2.5 rounded-full border-slate-200 hover:bg-slate-50 sm:border sm:py-1 sm:pr-4 sm:pl-1"
        >
          <Avatar name={owner.name} src={owner.avatar} size={36} />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-medium text-slate-900">{owner.name}</span>
            <span className="text-xs text-slate-500">{owner.position || "Владелец"}</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
