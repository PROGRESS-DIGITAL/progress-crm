"use client";

import { useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { saveDadataKey } from "./actions";

export function DadataKeyForm({ hasKey }: { hasKey: boolean }) {
  const [state, formAction, pending] = useActionState(saveDadataKey, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label={hasKey ? "Новый API-ключ" : "API-ключ"} error={state?.error}>
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder="40 символов из личного кабинета DaData"
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Проверяю…" : "Сохранить ключ"}
        </button>
        {state?.check && (
          <span className={`text-sm ${state.check.includes("работает") ? "text-emerald-700" : "text-amber-800"}`}>
            {state.check}
          </span>
        )}
      </div>
    </form>
  );
}
