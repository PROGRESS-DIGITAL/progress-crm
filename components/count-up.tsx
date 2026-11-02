"use client";

import { useEffect, useState } from "react";
import { formatRub } from "@/lib/format";

const DURATION = 1200;

// Число, которое при открытии страницы набегает от нуля до своего значения. Без анимации, если она выключена в системе
export function CountUp({ value, money, suffix = "" }: { value: number; money?: boolean; suffix?: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION, 1);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <>
      {money ? formatRub(shown) : shown.toLocaleString("ru-RU")}
      {suffix}
    </>
  );
}
