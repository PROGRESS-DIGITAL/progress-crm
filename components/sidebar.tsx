"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SIDEBAR_COOKIE } from "@/components/sidebar-cookie";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Theme } from "@/components/theme-cookie";
import { signOut } from "@/app/login/actions";

type Item = { href: string; label: string; icon: IconName; badge?: number };
type Group = { title: string; items: Item[] };

// Разделы собраны в четыре группы, чтобы меню было коротким: на компьютере и в мобильном меню
// группы раскрываются по нажатию на заголовок
function menu(newLeads: number, unreadChats: number, dueTasks: number, unreadMail: number, isOwner: boolean): Group[] {
  return [
    {
      title: "Работа",
      items: [
        { href: "/deals", label: "Сделки", icon: "home" },
        { href: "/leads", label: "Лиды", icon: "leads", badge: newLeads },
        { href: "/clients", label: "Клиенты", icon: "clients" },
        { href: "/tasks", label: "Задачи", icon: "tasks", badge: dueTasks },
        { href: "/calendar", label: "Календарь", icon: "calendar" },
      ],
    },
    {
      title: "Общение",
      items: [
        { href: "/chats", label: "Чаты", icon: "chat", badge: unreadChats },
        { href: "/mail", label: "Почта", icon: "mail", badge: unreadMail },
        { href: "/agents", label: "AI агенты", icon: "bot" },
      ],
    },
    {
      title: "Деньги",
      items: [
        { href: "/dashboard", label: "Дашборд", icon: "dashboard" },
        { href: "/finance", label: "Финансы", icon: "wallet" },
        { href: "/documents", label: "Документы", icon: "document" },
        { href: "/price", label: "Прайс", icon: "price" },
        { href: "/sales-map", label: "Планограмма", icon: "map" },
      ],
    },
    {
      title: "Настройки",
      items: [
        { href: "/integrations", label: "Интеграции", icon: "integrations" },
        ...(isOwner ? [{ href: "/employees", label: "Сотрудники", icon: "users" as const }] : []),
        { href: "/profile", label: "Личные данные", icon: "profile" },
      ],
    },
  ];
}

// Сотрудник видит только разделы своей роли; «Сотрудники» и «Личные данные» решаются отдельно
function allowed(groups: Group[], sections: string[]) {
  const open = (href: string) => {
    const key = href.slice(1);
    return key === "profile" || key === "employees" || sections.includes(key);
  };
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => open(i.href)) })).filter((g) => g.items.length > 0);
}

function SignOut({ collapsed }: { collapsed: boolean }) {
  return (
    <form action={signOut} className="border-t border-slate-100 pt-2">
      <button
        type="submit"
        title={collapsed ? "Выйти" : undefined}
        className={`flex h-11 w-full items-center gap-3 rounded-xl text-[15px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${
          collapsed ? "justify-center" : "px-3"
        }`}
      >
        <Icon name="logout" />
        {!collapsed && <span>Выйти</span>}
      </button>
    </form>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Логотип: знак «>» и название PROGRESS CRM. На компьютере клик по нему сворачивает и разворачивает меню
function Logo({ withName, onClick, title }: { withName: boolean; onClick?: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5" title={title} aria-label={title ?? "PROGRESS CRM"}>
      <span className="flex h-10 w-10 items-center justify-center logo-mark rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="5.4" strokeLinecap="square" strokeLinejoin="miter" aria-hidden>
          <path d="M8.5 5l7 7-7 7" />
        </svg>
      </span>
      {withName && (
        <span className="text-lg leading-tight tracking-tight">
          <span className="font-bold">PROGRESS</span>{" "}
          <span className="font-light text-blue-600">CRM</span>
        </span>
      )}
    </button>
  );
}

const OPEN_KEY = "crm-menu-open";

function NavItem({ item, collapsed, active }: { item: Item; collapsed: boolean; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-11 items-center gap-3 rounded-xl text-[15px] transition-colors ${collapsed ? "justify-center" : "px-3"} ${
          active ? "bg-blue-600 font-medium text-white shadow-sm shadow-blue-600/30" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <Icon name={item.icon} />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!!item.badge &&
          (collapsed ? (
            <span className="absolute top-2 right-3 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
          ) : (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? "bg-white/20 text-white" : "bg-blue-600 text-white"}`}>
              {item.badge}
            </span>
          ))}
      </Link>
    </li>
  );
}

// Группа текущего раздела всегда раскрыта; какие ещё группы открыты, браузер запоминает.
// В свёрнутом до иконок меню групп не видно: иконки идут подряд с разделителями
function NavGroups({ groups, collapsed, pathname }: { groups: Group[]; collapsed: boolean; pathname: string }) {
  const current = groups.find((g) => g.items.some((i) => isActive(pathname, i.href)))?.title;
  const [open, setOpen] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]");
      if (Array.isArray(saved)) setOpen(saved.filter((t) => typeof t === "string"));
    } catch {}
  }, []);

  function toggle(title: string) {
    const next = open.includes(title) ? open.filter((t) => t !== title) : [...open, title];
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {}
  }

  return (
    <nav className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto" aria-label="Разделы CRM">
      {groups.map((g) => {
        if (collapsed) {
          return (
            <div key={g.title} className="mb-1">
              <div className="mx-auto mb-2 h-px w-8 bg-slate-200" />
              <ul className="flex flex-col gap-1">
                {g.items.map((item) => (
                  <NavItem key={item.href} item={item} collapsed active={isActive(pathname, item.href)} />
                ))}
              </ul>
            </div>
          );
        }
        const isCurrent = g.title === current;
        const expanded = isCurrent || open.includes(g.title);
        const badge = g.items.reduce((a, i) => a + (i.badge ?? 0), 0);
        return (
          <div key={g.title}>
            <button
              type="button"
              onClick={() => toggle(g.title)}
              disabled={isCurrent}
              aria-expanded={expanded}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium tracking-wide text-slate-400 uppercase hover:text-slate-600 disabled:hover:text-slate-400"
            >
              <span className="flex-1">{g.title}</span>
              {!expanded && badge > 0 && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold tracking-normal text-white normal-case">{badge}</span>
              )}
              {!isCurrent && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              )}
            </button>
            {expanded && (
              <ul className="mt-1 mb-2 flex flex-col gap-1">
                {g.items.map((item) => (
                  <NavItem key={item.href} item={item} collapsed={false} active={isActive(pathname, item.href)} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// На компьютере меню слева, свёрнутое до иконок или развёрнутое с названиями.
// На телефоне снизу панель с главными разделами, остальные открываются кнопкой «Меню»
export function Sidebar({
  initialCollapsed,
  newLeads,
  unreadChats,
  dueTasks,
  unreadMail,
  sections,
  isOwner,
  theme,
}: {
  initialCollapsed: boolean;
  newLeads: number;
  unreadChats: number;
  dueTasks: number;
  unreadMail: number;
  sections: string[];
  isOwner: boolean;
  theme: Theme;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const groups = allowed(menu(newLeads, unreadChats, dueTasks, unreadMail, isOwner), sections);

  // Переход по ссылке закрывает мобильное меню
  useEffect(() => setDrawer(false), [pathname]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Снизу на телефоне помещается пять кнопок: четыре раздела и «Меню». У директора это сделки, лиды, календарь
  // и клиенты; у сотрудника с урезанной ролью их место занимают первые разделы его роли
  const all = groups.flatMap((g) => g.items);
  const TAB_ORDER = ["/deals", "/leads", "/calendar", "/clients"];
  const preferred = TAB_ORDER.map((href) => all.find((t) => t.href === href)).filter((t): t is Item => !!t);
  const tabs = [...preferred, ...all.filter((t) => !preferred.includes(t))].slice(0, 4);
  const inTabs = tabs.some((t) => isActive(pathname, t.href));
  const hiddenBadge = all.some((t) => !tabs.includes(t) && t.badge);

  return (
    <>
      <aside
        className={`sticky top-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col rounded-3xl bg-white p-3 shadow-card transition-[width] duration-200 md:flex ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        <div className={`flex h-12 items-center ${collapsed ? "justify-center" : "pl-2"}`}>
          <Logo withName={!collapsed} onClick={toggle} title={collapsed ? "Развернуть меню" : "Свернуть меню"} />
        </div>

        <NavGroups groups={groups} collapsed={collapsed} pathname={pathname} />
        <SignOut collapsed={collapsed} />
      </aside>

      <nav
        aria-label="Главные разделы"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] ${active ? "font-medium text-blue-600" : "text-slate-500"}`}
            >
              <Icon name={t.icon} size={22} />
              {t.label}
              {!!t.badge && (
                <span className="absolute top-0 left-1/2 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className={`relative flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] ${!inTabs ? "font-medium text-blue-600" : "text-slate-500"}`}
        >
          <Icon name="menu" size={22} />
          {hiddenBadge && <span className="absolute top-0.5 left-1/2 ml-2.5 h-2 w-2 rounded-full bg-rose-500" />}
          Меню
        </button>
      </nav>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Меню">
          <button
            type="button"
            aria-label="Закрыть меню"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white p-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-xl">
            <div className="flex h-12 items-center justify-between pl-2">
              <Logo withName onClick={() => setDrawer(false)} />
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Закрыть меню"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <NavGroups groups={groups} collapsed={false} pathname={pathname} />
            <div className="flex h-11 items-center justify-between border-t border-slate-100 px-3 text-[15px] text-slate-600">
              Тёмная тема
              <ThemeToggle initial={theme} />
            </div>
            <SignOut collapsed={false} />
          </div>
        </div>
      )}
    </>
  );
}
