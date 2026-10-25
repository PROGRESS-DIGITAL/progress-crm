"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SIDEBAR_COOKIE } from "@/components/sidebar-cookie";

type Item = { href: string; label: string; icon: IconName; badge?: number };


export function Sidebar({ initialCollapsed, newLeads }: { initialCollapsed: boolean; newLeads: number }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Главное",
      items: [
        { href: "/dashboard", label: "Дашборд", icon: "dashboard" },
        { href: "/leads", label: "Лиды", icon: "leads", badge: newLeads },
        { href: "/deals", label: "Сделки", icon: "deals" },
        { href: "/clients", label: "Клиенты", icon: "clients" },
      ],
    },
    {
      title: "Продажи",
      items: [
        { href: "/sales-map", label: "Планограмма", icon: "map" },
        { href: "/price", label: "Прайс", icon: "price" },
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

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={`sticky top-3 flex h-[calc(100dvh-1.5rem)] shrink-0 flex-col rounded-3xl bg-white p-3 shadow-card transition-[width] duration-200 ${
        collapsed ? "w-[76px]" : "w-64"
      }`}
    >
      <div className={`flex h-12 items-center ${collapsed ? "justify-center" : "justify-between pl-2"}`}>
        <Link href="/deals" className="flex items-center gap-2.5" title="PROGRESS CRM">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-sm">
            P
          </span>
          {!collapsed && (
            <span className="text-lg leading-tight font-semibold tracking-tight">
              PROGRESS <span className="text-blue-600">CRM</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            title="Свернуть меню"
            aria-label="Свернуть меню"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          >
            <Icon name="collapse" size={16} />
          </button>
        )}
      </div>

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
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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

      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          title="Развернуть меню"
          aria-label="Развернуть меню"
          className="mx-auto mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
        >
          <Icon name="expand" size={18} />
        </button>
      )}
    </aside>
  );
}
