"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Новые сообщения подтягиваются сами, пока вкладка открыта
export function AutoRefresh({ ms = 4000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}
