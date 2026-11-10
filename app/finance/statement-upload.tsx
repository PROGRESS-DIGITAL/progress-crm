"use client";

import { useActionState } from "react";
import { importStatementAction } from "./actions";

// Загрузка выписки в формате 1С: выбрали файл — он сразу уходит на сервер
export function StatementUpload() {
  const [state, formAction, pending] = useActionState(importStatementAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <label className={`cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 ${pending ? "opacity-60" : ""}`}>
        {pending ? "Загружаю выписку…" : "Загрузить выписку 1С"}
        <input
          name="file"
          type="file"
          accept=".txt"
          className="sr-only"
          disabled={pending}
          onChange={(e) => e.currentTarget.files?.length && e.currentTarget.form?.requestSubmit()}
        />
      </label>
      {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
    </form>
  );
}
