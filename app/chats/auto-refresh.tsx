"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

// Страница обновляется раз в ms, пока она открыта. Пока идёт обновление или переход, новых не запускаем
export function AutoRefresh({ ms = 2000 }: { ms?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = useRef(pending);
  busy.current = pending;

  useEffect(() => {
    const id = setInterval(() => {
      if (!busy.current && document.visibilityState === "visible") startTransition(() => router.refresh());
    }, ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}
