"use client";

import { useState } from "react";
import { THEME_COOKIE, type Theme } from "@/components/theme-cookie";

function Sun() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  );
}

function Moon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}

// Переключатель как на iOS: в светлой теме слева месяц, справа тёмный кружок; в тёмной — светлый кружок слева, солнце справа
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const dark = theme === "dark";

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
      title={dark ? "Светлая тема" : "Тёмная тема"}
      onClick={toggle}
      className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        dark ? "bg-[#0d0d0d] text-white" : "bg-[#ececec] text-[#1a1a1a] shadow-[inset_0_1px_3px_rgb(0_0_0/0.12)]"
      }`}
    >
      <span className={`absolute top-1/2 -translate-y-1/2 transition-all ${dark ? "right-1.5 text-[#f4f4f4]" : "left-1.5"}`}>
        {dark ? <Sun /> : <Moon />}
      </span>
      <span
        className={`absolute top-[3px] h-[18px] w-[18px] rounded-full shadow transition-all ${dark ? "left-[3px] bg-[#f4f4f4]" : "left-[23px] bg-[#2b2b2b]"}`}
      />
    </button>
  );
}
