"use client";

import { useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { saveYandex } from "./actions";

export function YandexForm({ hasKey, folderId, model }: { hasKey: boolean; folderId: string; model: string }) {
  const [state, formAction, pending] = useActionState(saveYandex, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label={hasKey ? "Новый API-ключ (оставьте пустым, чтобы не менять)" : "API-ключ"} error={state?.error}>
        <input name="apiKey" type="password" autoComplete="off" placeholder="AQVN…" className={inputClass} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Идентификатор каталога">
          <input name="folderId" defaultValue={folderId} placeholder="b1g…" autoComplete="off" spellCheck={false} className={inputClass} required />
        </Field>
        <Field label="Модель">
          <input name="model" defaultValue={model} autoComplete="off" spellCheck={false} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Проверяю…" : "Сохранить"}
        </button>
        {state?.check && <span className={`text-sm ${state.ok ? "text-emerald-700" : "text-amber-800"}`}>{state.check}</span>}
      </div>
    </form>
  );
}
