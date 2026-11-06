"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { ActivityIcon } from "@/components/activity-icon";
import { openActivity, type ActivityItem } from "@/app/activity/actions";

// Колокольчик в шапке: журнал событий CRM. Цифра — события, которых сотрудник ещё не видел
export function ActivityBell({ unseen }: { unseen: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [count, setCount] = useState(unseen);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setCount(unseen), [unseen]);
  // Перешли по ссылке из списка — закрываем
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    start(async () => {
      setItems(await openActivity());
      setCount(0);
    });
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        title="Журнал событий"
        aria-label={count ? `Журнал событий, новых: ${count}` : "Журнал событий"}
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
      >
        <Icon name="bell" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-[4.5rem] z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:top-14 sm:right-0 sm:w-[26rem]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold">Журнал событий</p>
            <Link href="/trash" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
              <Icon name="trash" size={15} />
              Корзина
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!items ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">{pending ? "Загружаю…" : ""}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Событий пока нет</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((e) => (
                  <li key={e.id}>
                    <ActivityRow item={e} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/activity" className="border-t border-slate-100 px-4 py-3 text-center text-sm font-medium text-blue-600 hover:bg-slate-50">
            Весь журнал
          </Link>
        </div>
      )}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const body = (
    <>
      <ActivityIcon kind={item.kind} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-800">{item.text}</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {item.when}
          {item.actor && ` · ${item.actor}`}
        </span>
      </span>
      {item.fresh && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="новое" />}
    </>
  );
  const cls = "flex items-start gap-3 px-4 py-3";
  return item.href ? (
    <Link href={item.href} className={`${cls} hover:bg-slate-50`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
