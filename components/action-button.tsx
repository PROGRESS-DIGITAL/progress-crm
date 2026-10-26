"use client";

import { useActionState } from "react";

export type ActionResult = { error?: string; ok?: string } | undefined;

// Кнопка, которая вызывает серверное действие и показывает результат рядом
export function ActionButton({
  action,
  label,
  pendingLabel,
  primary,
  confirmText,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  primary?: boolean;
  confirmText?: string;
}) {
  const [state, formAction, pending] = useActionState(async () => action(), undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <button
        type="submit"
        disabled={pending}
        className={
          primary
            ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60"
            : "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
        }
      >
        {pending ? (pendingLabel ?? "Подождите…") : label}
      </button>
      {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
      {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
    </form>
  );
}
