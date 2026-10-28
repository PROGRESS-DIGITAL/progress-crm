"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

// Ошибка при загрузке раздела: меню остаётся на месте, страница пробует загрузиться ещё раз сама
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  useEffect(() => {
    console.error(error);
    const id = setTimeout(retry, 2000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <p className="text-lg font-semibold">Страница не загрузилась</p>
      <p className="max-w-md text-sm text-slate-500">Пробуем ещё раз. Если не получится, нажмите «Повторить».</p>
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Загружаю…" : "Повторить"}
      </button>
      {error.digest && <p className="text-xs text-slate-400">Код ошибки: {error.digest}</p>}
    </div>
  );
}
