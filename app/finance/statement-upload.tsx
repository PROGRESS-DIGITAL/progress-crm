"use client";

import { FileDrop } from "@/components/file-drop";
import { useActionState } from "react";
import { importStatementAction } from "./actions";

// Загрузка выписки в формате 1С: выбрали файл — он сразу уходит на сервер.
// link — тихая ссылка рядом с заголовком, как «Дашборд →» в Сделках
export function StatementUpload({ link = false }: { link?: boolean }) {
  const [state, formAction, pending] = useActionState(importStatementAction, undefined);
  return (
    <form action={formAction}>
      <FileDrop
        compact
        disabled={pending}
        hint={link ? "Отпустите" : "Отпустите, чтобы загрузить выписку"}
        wrongType={link ? "Нужен .txt" : "Нужна выписка 1С в .txt"}
        className={`-m-1.5 flex flex-wrap items-center rounded-xl p-1.5 ${link ? "gap-x-3 gap-y-1" : "gap-3"}`}
      >
        <label
          className={
            link
              ? `cursor-pointer text-xs text-slate-500 hover:text-slate-800 hover:underline ${pending ? "opacity-60" : ""}`
              : `cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 ${pending ? "opacity-60" : ""}`
          }
        >
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
        {state?.ok && <span className={`${link ? "text-xs" : "text-sm"} text-emerald-700`}>{state.ok}</span>}
        {state?.error && <span className={`${link ? "text-xs" : "text-sm"} text-rose-600`}>{state.error}</span>}
      </FileDrop>
    </form>
  );
}
