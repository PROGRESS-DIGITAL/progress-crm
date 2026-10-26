"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkDiadocLogin } from "./actions";

// Ждём, пока пользователь подтвердит вход в Контуре
export function LoginWaiter({ interval }: { interval: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    const id = setInterval(async () => {
      if (stop) return;
      const r = await checkDiadocLogin();
      if (r.done) {
        stop = true;
        router.refresh();
      } else if (r.error) {
        stop = true;
        setError(r.error);
      }
    }, interval * 1000);
    return () => clearInterval(id);
  }, [interval, router]);
  return error ? (
    <p className="text-sm text-rose-600">{error}</p>
  ) : (
    <p className="text-sm text-slate-500">Жду подтверждения входа…</p>
  );
}
