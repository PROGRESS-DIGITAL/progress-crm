"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LoadingBar } from "@/components/loading-bar";

// Сбои за последние 20 секунд: короткий сбой страница переживает сама, показывая полосу загрузки,
// и только если раздел не грузится раз за разом, просим нажать «Повторить»
let recent: number[] = [];

// Текст ошибки уходит в окно Терминала, где запущена CRM: по нему видно, что именно упало
function report(error: Error & { digest?: string }) {
  try {
    const body = JSON.stringify({ message: error.message, digest: error.digest, stack: error.stack?.slice(0, 2000), url: location.href });
    fetch("/api/client-error", { method: "POST", body, keepalive: true }).catch(() => undefined);
  } catch {}
}

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gaveUp] = useState(() => {
    const now = Date.now();
    recent = [...recent.filter((t) => now - t < 20_000), now];
    return recent.length > 3;
  });
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  useEffect(() => {
    console.error(error);
    report(error);
    if (gaveUp) return;
    const id = setTimeout(retry, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  if (!gaveUp || pending) return <LoadingBar className="flex-1" />;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <p className="text-lg font-semibold">Страница не загрузилась</p>
      <p className="max-w-md text-sm text-slate-500">Нажмите «Повторить». Если не поможет, перезапустите CRM.</p>
      <button
        type="button"
        onClick={() => {
          recent = [];
          retry();
        }}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Повторить
      </button>
      {/* Текст ошибки нужен, чтобы по скриншоту было понятно, что именно упало */}
      <p className="max-w-md text-xs break-words text-slate-400">
        {error.digest ? `Код ошибки: ${error.digest}` : error.message || error.name}
      </p>
    </div>
  );
}
