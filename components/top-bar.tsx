import Link from "next/link";
import type { AuthUser } from "@/lib/auth/session";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Theme } from "@/components/theme-cookie";

function greeting(now: Date) {
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Moscow" }));
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

// Верхняя панель: приветствие, поиск клиентов, новые лиды и карточка того, кто вошёл.
// Поиск и колокольчик лидов видны, только если роль открывает клиентов и лиды
export function TopBar({ newLeads, theme, user }: { newLeads: number; theme: Theme; user: AuthUser }) {
  const firstName = user.name.split(/\s+/)[0];
  const clients = user.sections.includes("clients");
  const leads = user.sections.includes("leads");
  return (
    <header className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-card sm:min-h-16 sm:gap-4 sm:rounded-3xl sm:px-5 sm:py-3">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold tracking-tight sm:text-lg">
          {greeting(new Date())}, {firstName}!
        </p>
        <p className="hidden text-xs text-slate-500 sm:block">Сделки, клиенты и выручка PROGRESS Digital</p>
      </div>
      <ThemeToggle initial={theme} />

      {clients && (
        <form action="/clients" className="relative ml-auto hidden w-full max-w-sm md:block" role="search">
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            type="search"
            placeholder="Найти клиента по названию, ИНН, телефону"
            className="h-11 w-full rounded-2xl border border-transparent bg-slate-100 pr-4 pl-10 text-sm outline-none placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </form>
      )}

      <div className={`ml-auto flex shrink-0 items-center gap-2 ${clients ? "md:ml-0" : ""}`}>
        {leads && (
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
        )}
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
