"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

// Чат обновляется почти сразу после нового сообщения: раз в 2 секунды спрашиваем у сервера короткий
// отпечаток и перерисовываем страницу, только если он изменился. Без отпечатка страница просто
// обновляется раз в ms. Пока идёт обновление или переход, новых не запускаем: наложение обновлений
// и роняло страницу
export function AutoRefresh({ version, ms = 2000 }: { version?: string; ms?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const latest = useRef({ version, pending });
  latest.current = { version, pending };

  useEffect(() => {
    let busy = false;
    const id = setInterval(async () => {
      if (busy || latest.current.pending || document.visibilityState !== "visible") return;
      busy = true;
      try {
        if (latest.current.version === undefined) startTransition(() => router.refresh());
        else {
          const r = await fetch("/api/chats/version", { cache: "no-store" });
          const { v } = (await r.json()) as { v: string };
          if (v && v !== latest.current.version) startTransition(() => router.refresh());
        }
      } catch {
        // Сервер перезапускается или пропала сеть: попробуем на следующем шаге
      } finally {
        busy = false;
      }
    }, ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}
