"use client";

import { useEffect, useState, type HTMLAttributes, type Ref } from "react";

// Палец вместо мыши (телефон, планшет): на таких экранах карточки канбана тащат только за ручку,
// а тап по самой карточке открывает её. На компьютере всё по-прежнему: карточку тянут целиком
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return coarse;
}

// Ручка в правом верхнем углу карточки. Зона нажатия 40×40, хотя значок маленький.
// touch-action: none — чтобы палец на ручке не листал страницу, а сразу брал карточку
export function DragHandle({
  handleRef,
  label,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { handleRef?: Ref<HTMLButtonElement>; label: string }) {
  return (
    <button
      type="button"
      ref={handleRef}
      {...props}
      aria-label={label}
      title={label}
      onClick={(e) => e.stopPropagation()}
      style={{ touchAction: "none" }}
      className="absolute -top-0.5 -right-0.5 z-10 flex h-10 w-10 cursor-grab items-center justify-center rounded-xl text-slate-400 active:bg-slate-100 active:text-slate-700"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <circle cx="5.5" cy="3" r="1.5" />
        <circle cx="10.5" cy="3" r="1.5" />
        <circle cx="5.5" cy="8" r="1.5" />
        <circle cx="10.5" cy="8" r="1.5" />
        <circle cx="5.5" cy="13" r="1.5" />
        <circle cx="10.5" cy="13" r="1.5" />
      </svg>
    </button>
  );
}
