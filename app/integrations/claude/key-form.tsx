"use client";

import { useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { saveClaude } from "./actions";

export function ClaudeForm({ hasKey, baseUrl }: { hasKey: boolean; baseUrl: string }) {
  const [state, formAction, pending] = useActionState(saveClaude, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label={hasKey ? "Новый ключ API (оставьте пустым, чтобы не менять)" : "Ключ API"} error={state?.error}>
        <input name="apiKey" type="password" autoComplete="off" placeholder="sk-ant-…" className={inputClass} />
      </Field>
      <Field label="Адрес API">
        <input name="baseUrl" defaultValue={baseUrl} placeholder="https://api.anthropic.com" autoComplete="off" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Проверяю…" : "Сохранить"}
        </button>
        {state?.check && <span className={`text-sm ${state.ok ? "text-emerald-700" : "text-amber-800"}`}>{state.check}</span>}
      </div>
    </form>
  );
}
