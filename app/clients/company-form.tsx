"use client";

import { useActionState } from "react";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";

export type CompanyValues = {
  name: string;
  inn: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export function CompanyForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: CompanyValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, initial, name);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Название компании" error={err.name} wide>
        <input name="name" defaultValue={v("name")} required className={inputClass} />
      </Field>
      <Field label="ИНН" error={err.inn}>
        <input name="inn" inputMode="numeric" defaultValue={v("inn")} className={inputClass} />
      </Field>
      <Field label="Сайт" error={err.website}>
        <input name="website" defaultValue={v("website")} className={inputClass} />
      </Field>
      <Field label="Телефон" error={err.phone}>
        <input name="phone" type="tel" defaultValue={v("phone")} className={inputClass} />
      </Field>
      <Field label="Email" error={err.email}>
        <input name="email" type="email" defaultValue={v("email")} className={inputClass} />
      </Field>
      <Field label="Адрес" error={err.address} wide>
        <input name="address" defaultValue={v("address")} className={inputClass} />
      </Field>
      <Field label="Заметки" error={err.notes} wide>
        <textarea name="notes" rows={3} defaultValue={v("notes")} className={inputClass} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : submitLabel}
        </button>
        {state?.saved && !pending && <span className="text-sm text-emerald-600">Сохранено</span>}
      </div>
    </form>
  );
}
