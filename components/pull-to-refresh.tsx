"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

// Насколько тянуть, чтобы отпустить и обновить, и дальше какого места кружок не едет
const THRESHOLD = 72;
const MAX = 120;
// Палец уходит дальше кружка: так тянется туго, как в приложениях
const RESISTANCE = 0.5;

// Внутри таких мест жест свой: поля ввода, окна, карточки, которые перетаскивают на досках
const SKIP = "input, textarea, select, [contenteditable='true'], [role='dialog'], [aria-roledescription], [data-no-pull]";

// Палец внутри блока со своей прокруткой, которую ещё можно вести вверх: тянем её, а не страницу
function insideScrolled(el: Element | null) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollTop > 0 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return true;
  }
  return false;
}

// Обновление страницы потягиванием вниз на телефоне: сверху выезжает кружок, отпустили ниже черты — данные перезагружаются
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, start] = useTransition();
  const pullRef = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!matchMedia("(pointer: coarse)").matches) return;
    let gesture: { x: number; y: number; decided: boolean } | null = null;
    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1 || window.scrollY > 0) return;
      const target = e.target as Element | null;
      if (target?.closest(SKIP) || insideScrolled(target)) return;
      gesture = { x: e.touches[0].clientX, y: e.touches[0].clientY, decided: false };
    };

    const onMove = (e: TouchEvent) => {
      if (!gesture) return;
      const dx = e.touches[0].clientX - gesture.x;
      const dy = e.touches[0].clientY - gesture.y;
      if (!gesture.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Вбок или вверх — это прокрутка доски или страницы, не обновление
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
          gesture = null;
          return;
        }
        gesture.decided = true;
        setDragging(true);
      }
      // Пока тянем, страница не пружинит и браузер не включает своё обновление
      if (e.cancelable) e.preventDefault();
      set(Math.max(0, Math.min(MAX, dy * RESISTANCE)));
    };

    const onEnd = () => {
      const was = gesture?.decided;
      gesture = null;
      if (!was) return;
      setDragging(false);
      if (pullRef.current >= THRESHOLD) {
        busy.current = true;
        set(THRESHOLD * 0.75);
        start(() => router.refresh());
        // Если ответ так и не пришёл, кружок не должен висеть вечно
        setTimeout(() => {
          if (!busy.current) return;
          busy.current = false;
          set(0);
        }, 15_000);
      } else set(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  // Данные пришли: кружок уезжает обратно
  useEffect(() => {
    if (refreshing || !busy.current) return;
    busy.current = false;
    pullRef.current = 0;
    setPull(0);
  }, [refreshing]);

  if (pull === 0 && !refreshing) return null;
  const ready = pull >= THRESHOLD || refreshing;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{
        transform: `translateY(${pull - 44}px)`,
        transition: dragging ? "none" : "transform 200ms ease-out",
      }}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-card ${ready ? "text-blue-600" : "text-slate-400"}`}
        style={{ opacity: Math.min(1, pull / (THRESHOLD * 0.6)) }}
      >
        <span className={refreshing ? "animate-spin" : undefined} style={refreshing ? undefined : { transform: `rotate(${(pull / THRESHOLD) * 270}deg)` }}>
          <Icon name="refresh" size={20} />
        </span>
        <span className="sr-only">{refreshing ? "Обновляю страницу" : ready ? "Отпустите, чтобы обновить" : "Потяните, чтобы обновить"}</span>
      </span>
    </div>
  );
}
