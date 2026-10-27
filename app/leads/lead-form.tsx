"use client";

import { useActionState } from "react";
import Link from "next/link";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";
import { PhoneInput } from "@/components/phone-input";

export function LeadForm({ action }: { action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, undefined, name);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Имя" error={err.name}>
        <input name="name" defaultValue={v("name")} className={inputClass} />
      </Field>
      <Field label="Компания" error={err.companyName}>
        <input name="companyName" defaultValue={v("companyName")} className={inputClass} />
      </Field>
      <Field label="Телефон" error={err.phone}>
        <PhoneInput defaultValue={v("phone")} className={inputClass} />
      </Field>
      <Field label="Email" error={err.email}>
        <input name="email" type="email" defaultValue={v("email")} className={inputClass} />
      </Field>
      <Field label="Ответственный" error={err.owner}>
        <input name="owner" defaultValue={v("owner")} className={inputClass} />
      </Field>
      <Field label="Что хочет клиент" error={err.message} wide>
        <textarea name="message" rows={4} defaultValue={v("message")} className={inputClass} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Создать лид"}
        </button>
        <Link href="/leads" className="text-sm text-slate-600 hover:text-slate-900">
          Отмена
        </Link>
      </div>
    </form>
  );
}
