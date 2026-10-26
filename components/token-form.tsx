"use client";

import { useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";

export type TokenState = { error?: string; ok?: string } | undefined;

// Форма ключа мессенджера: ключ скрыт, после сохранения показываем, что проверка прошла
export function TokenForm({
  action,
  label,
  placeholder,
  submitLabel,
  extra,
}: {
  action: (prev: TokenState, formData: FormData) => Promise<TokenState>;
  label: string;
  placeholder: string;
  submitLabel: string;
  // Дополнительные поля перед ключом
  extra?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {extra}
      <Field label={label} error={state?.error}>
        <input name="token" type="password" autoComplete="off" placeholder={placeholder} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Проверяю…" : submitLabel}
        </button>
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      </div>
    </form>
  );
}
