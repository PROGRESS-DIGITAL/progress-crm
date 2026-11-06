import { Suspense } from "react";
import Link from "next/link";
import type { AuthUser } from "@/lib/auth/session";
import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderClock } from "@/components/header-clock";
import { HeaderSearch } from "@/components/header-search";
import { ActivityBell } from "@/components/activity-bell";
import type { Theme } from "@/components/theme-cookie";

function greeting(now: Date) {
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Moscow" }));
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

// Верхняя панель: приветствие, часы, поиск клиентов, журнал событий и карточка того, кто вошёл.
// Поиск виден, только если роль открывает клиентов
export async function TopBar({ unseenActivity, theme, user }: { unseenActivity: number; theme: Theme; user: AuthUser }) {
  const firstName = user.name.split(/\s+/)[0];
  const clients = user.sections.includes("clients");
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
        <HeaderClock serverNow={Date.now()} userId={user.id} />
        {clients && (
          <Suspense>
            <HeaderSearch />
          </Suspense>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ActivityBell unseen={unseenActivity} />
        <Link
          href="/profile"
          title="Личные данные"
          className="flex items-center gap-2.5 rounded-full border-slate-200 hover:bg-slate-50 sm:border sm:py-1 sm:pr-4 sm:pl-1"
        >
          <Avatar name={user.name} src={user.avatar} size={36} />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-medium text-slate-900">{user.name}</span>
            <span className="text-xs text-slate-500">{user.position || user.roleName || "Сотрудник"}</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
