"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Ask = { title: string; text?: string; ok?: string };
type Pending = Ask & { resolve: (ok: boolean) => void };

// Без провайдера (например, в тестах) остаётся системное окно браузера
const ConfirmContext = createContext<(ask: Ask) => Promise<boolean>>(async (ask) => window.confirm(ask.title));

// Спросить подтверждение своим окном: await confirm({ title: "Вы точно хотите удалить …?" }) вернёт true при «Ок»
export function useConfirm() {
  return useContext(ConfirmContext);
}

// Одно окно подтверждения на всё приложение: «Вы точно хотите удалить …?» с кнопками «Ок» и «Отмена»
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((ask: Ask) => new Promise<boolean>((resolve) => setPending({ ...ask, resolve })), []);

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(false);
      }
    };
    // capture: Esc закрывает только это окно, а не окно события под ним
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] transition-opacity duration-150 starting:opacity-0"
          onClick={() => close(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl transition duration-150 starting:scale-95 starting:opacity-0"
          >
            <p id="confirm-title" className="text-base font-semibold text-slate-900">
              {pending.title}
            </p>
            {pending.text && <p className="mt-2 text-sm text-slate-600">{pending.text}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => close(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className="min-w-20 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-rose-600/25 hover:bg-rose-700"
              >
                {pending.ok ?? "Ок"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
