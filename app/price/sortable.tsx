"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import { reorderProducts } from "./actions";

type Handle = { onPointerDown: (e: React.PointerEvent) => void; onKeyDown: (e: React.KeyboardEvent) => void; dragging: boolean };
const SortContext = createContext<(id: string) => Handle | null>(() => null);

// Ручка перетаскивания для строки: берётся из ближайшего списка
export function useSortHandle(id: string) {
  return useContext(SortContext)(id);
}

type Drag = { id: string; from: number; startY: number; dy: number; tops: number[]; heights: number[] };

// Список услуг одного раздела, порядок меняется перетаскиванием за ручку (мышью и пальцем) или стрелками с клавиатуры
export function SortableProducts({ category, items }: { category: string; items: { id: string; node: React.ReactNode }[] }) {
  const ids = items.map((i) => i.id);
  const [order, setOrder] = useState(ids);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const rows = useRef(new Map<string, HTMLLIElement>());
  const key = ids.join(",");

  // Сервер прислал новый состав раздела: добавили или удалили услугу
  useEffect(() => setOrder(key.split(",")), [key]);

  function save(next: string[]) {
    const previous = order;
    setOrder(next);
    setError(null);
    start(async () => {
      const res = await reorderProducts(category, next);
      if (res.error) {
        setOrder(previous);
        setError(res.error);
      }
    });
  }

  // Куда встанет перетаскиваемая строка: по её середине среди остальных
  function target(d: Drag) {
    const center = d.tops[d.from] + d.heights[d.from] / 2 + d.dy;
    let to = 0;
    d.tops.forEach((top, i) => {
      if (i !== d.from && top + d.heights[i] / 2 < center) to++;
    });
    return to;
  }

  function handle(id: string): Handle {
    return {
      dragging: drag?.id === id,
      onPointerDown(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        const els = order.map((x) => rows.current.get(x)!);
        const d: Drag = {
          id,
          from: order.indexOf(id),
          startY: e.clientY,
          dy: 0,
          tops: els.map((el) => el.getBoundingClientRect().top),
          heights: els.map((el) => el.getBoundingClientRect().height),
        };
        setDrag(d);
        const move = (ev: PointerEvent) => setDrag((p) => p && { ...p, dy: ev.clientY - p.startY });
        const up = (ev: PointerEvent) => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          const done = { ...d, dy: ev.type === "pointercancel" ? 0 : ev.clientY - d.startY };
          setDrag(null);
          const to = target(done);
          if (to === done.from) return;
          const next = order.filter((x) => x !== id);
          next.splice(to, 0, id);
          save(next);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      },
      onKeyDown(e) {
        const from = order.indexOf(id);
        const to = e.key === "ArrowUp" ? from - 1 : e.key === "ArrowDown" ? from + 1 : -1;
        if (to < 0 || to >= order.length) return;
        e.preventDefault();
        const next = [...order];
        next.splice(from, 1);
        next.splice(to, 0, id);
        save(next);
      },
    };
  }

  // Пока строку тащат, соседи между старым и новым местом сдвигаются на её высоту
  function shift(i: number) {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    const to = target(drag);
    const h = drag.heights[drag.from];
    if (drag.from < to && i > drag.from && i <= to) return -h;
    if (drag.from > to && i >= to && i < drag.from) return h;
    return 0;
  }

  const byId = new Map(items.map((i) => [i.id, i.node]));
  return (
    <SortContext.Provider value={(id) => handle(id)}>
      <ul className="divide-y divide-slate-100">
        {order
          .filter((id) => byId.has(id))
          .map((id, i) => (
            <li
              key={id}
              ref={(el) => {
                if (el) rows.current.set(id, el);
                else rows.current.delete(id);
              }}
              style={{ transform: `translateY(${shift(i)}px)` }}
              className={`relative bg-white ${
                drag?.id === id ? "z-10 rounded-xl shadow-lg ring-1 ring-blue-200" : drag ? "transition-transform duration-150" : ""
              }`}
            >
              {byId.get(id)}
            </li>
          ))}
      </ul>
      {error && <p className="border-t border-slate-100 px-4 py-2 text-sm text-rose-600">{error}</p>}
    </SortContext.Provider>
  );
}
