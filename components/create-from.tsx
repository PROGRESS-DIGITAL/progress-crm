"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { KindMark } from "@/components/event-kind";

export type CreateFromLink = { companyId?: string | null; dealId?: string | null; taskId?: string | null };

// Ссылки на новые сделку, задачу и встречу с привязкой к карточке, из которой их создают:
// клиент переходит во всё, сделка — в задачу и встречу, задача — во встречу и подзадачу
export function createFromHrefs({ companyId, dealId, taskId }: CreateFromLink) {
  const q = (pairs: [string, string | null | undefined][]) => {
    const p = new URLSearchParams();
    for (const [k, v] of pairs) if (v) p.set(k, v);
    return p.toString();
  };
  return {
    deal: `/deals/new${companyId ? `?${q([["companyId", companyId]])}` : ""}`,
    task: `/tasks/new?${q([["deal", dealId], ["client", companyId], ["task", taskId]])}`.replace(/\?$/, ""),
    meeting: `/calendar?${q([["new", "MEETING"], ["deal", dealId], ["client", companyId], ["task", taskId]])}`,
  };
}

// Кнопка «Создать» в карточке сделки, задачи или встречи: меню из трёх пунктов
export function CreateFrom({ link, align = "right", className = "" }: { link: CreateFromLink; align?: "left" | "right"; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const hrefs = createFromHrefs(link);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc закрывает только меню, а не окно встречи под ним
      e.stopImmediatePropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const item = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900";
  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Icon name="plus" size={16} />
        Создать
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-30 mt-1.5 w-52 rounded-xl border border-slate-200/70 bg-white p-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
        >
          <Link role="menuitem" href={hrefs.deal} onClick={() => setOpen(false)} className={item}>
            <Icon name="deals" size={16} className="text-slate-400" />
            Сделку
          </Link>
          <Link role="menuitem" href={hrefs.task} onClick={() => setOpen(false)} className={item}>
            <span className="flex w-4 justify-center">
              <KindMark kind="TASK" />
            </span>
            Задачу
          </Link>
          <Link role="menuitem" href={hrefs.meeting} onClick={() => setOpen(false)} className={item}>
            <span className="flex w-4 justify-center">
              <KindMark kind="MEETING" />
            </span>
            Встречу
          </Link>
        </div>
      )}
    </div>
  );
}
