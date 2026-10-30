"use client";

import { useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Текущий пароль">
        <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Новый пароль">
          <input name="password" type="password" required autoComplete="new-password" className={inputClass} />
        </Field>
        <Field label="Ещё раз">
          <input name="password2" type="password" required autoComplete="new-password" className={inputClass} />
        </Field>
      </div>
      <p className="text-xs text-slate-500">Не короче 10 символов, с буквами и цифрами.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Сменить пароль"}
        </button>
        {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      </div>
    </form>
  );
}
