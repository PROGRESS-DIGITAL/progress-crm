"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SIDEBAR_COOKIE } from "@/components/sidebar-cookie";

type Item = { href: string; label: string; icon: IconName; badge?: number };
type Group = { title: string; items: Item[] };

function menu(newLeads: number, unreadChats: number): Group[] {
  return [
    {
      title: "Главное",
      items: [
        { href: "/deals", label: "Сделки", icon: "home" },
        { href: "/dashboard", label: "Дашборд", icon: "dashboard" },
        { href: "/leads", label: "Лиды", icon: "leads", badge: newLeads },
        { href: "/calendar", label: "Календарь", icon: "calendar" },
        { href: "/clients", label: "Клиенты", icon: "clients" },
        { href: "/chats", label: "Чаты", icon: "chat", badge: unreadChats },
      ],
    },
    {
      title: "Продажи",
      items: [
        { href: "/sales-map", label: "Планограмма", icon: "map" },
        { href: "/price", label: "Прайс", icon: "price" },
        { href: "/finance", label: "Финансы", icon: "wallet" },
        { href: "/documents", label: "Документы", icon: "document" },
      ],
    },
    {
      title: "Общее",
      items: [
        { href: "/integrations", label: "Интеграции", icon: "integrations" },
        { href: "/profile", label: "Личные данные", icon: "profile" },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Логотип: знак «>» и название PROCRM. На компьютере клик по нему сворачивает и разворачивает меню
function Logo({ withName, onClick, title }: { withName: boolean; onClick?: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5" title={title} aria-label={title ?? "PROCRM"}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="square" strokeLinejoin="miter" aria-hidden>
          <path d="M8.5 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </span>
      {withName && (
        <span className="text-lg leading-tight tracking-tight">
          <span className="font-bold">PRO</span>
          <span className="font-light text-blue-600">CRM</span>
        </span>
      )}
    </button>
  );
}

function NavGroups({ groups, collapsed, pathname }: { groups: Group[]; collapsed: boolean; pathname: string }) {
  return (
    <nav className="mt-4 flex flex-1 flex-col gap-5 overflow-y-auto" aria-label="Разделы CRM">
      {groups.map((g) => (
        <div key={g.title}>
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-8 bg-slate-200" />
          ) : (
            <p className="mb-2 px-3 text-xs font-medium text-slate-400">{g.title}</p>
          )}
          <ul className="flex flex-col gap-1">
            {g.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-11 items-center gap-3 rounded-xl text-[15px] transition-colors ${
                      collapsed ? "justify-center" : "px-3"
                    } ${
                      active
                        ? "bg-blue-600 font-medium text-white shadow-sm shadow-blue-600/30"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon name={item.icon} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!!item.badge &&
                      (collapsed ? (
                        <span className="absolute top-2 right-3 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            active ? "bg-white/20 text-white" : "bg-blue-600 text-white"
                          }`}
                        >
                          {item.badge}
                        </span>
                      ))}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// На компьютере меню слева, свёрнутое до иконок или развёрнутое с названиями.
// На телефоне снизу панель с главными разделами, остальные открываются кнопкой «Меню»
export function Sidebar({
  initialCollapsed,
  newLeads,
  unreadChats,
}: {
  initialCollapsed: boolean;
  newLeads: number;
  unreadChats: number;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const groups = menu(newLeads, unreadChats);

  // Переход по ссылке закрывает мобильное меню
  useEffect(() => setDrawer(false), [pathname]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Снизу на телефоне помещается пять кнопок: дашборд остаётся в «Меню»
  const tabs = groups[0].items.filter((t) => t.href !== "/dashboard");
  const inTabs = tabs.some((t) => isActive(pathname, t.href));

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
          className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] ${!inTabs ? "font-medium text-blue-600" : "text-slate-500"}`}
        >
          <Icon name="menu" size={22} />
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
          </div>
        </div>
      )}
    </>
  );
}
