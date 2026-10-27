"use client";

import { useActionState, useEffect, useRef } from "react";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";
import { PhoneInput } from "@/components/phone-input";

export type ContactValues = {
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export function ContactForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: ContactValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, initial, name);

  // После добавления контакта форма очищается под следующий
  useEffect(() => {
    if (state?.saved && !initial) formRef.current?.reset();
  }, [state, initial]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-2">
      <Field label="Имя" error={err.fullName}>
        <input name="fullName" defaultValue={v("fullName")} required className={inputClass} />
      </Field>
      <Field label="Должность" error={err.position}>
        <input name="position" defaultValue={v("position")} className={inputClass} />
      </Field>
      <Field label="Телефон" error={err.phone}>
        <PhoneInput defaultValue={v("phone")} className={inputClass} />
      </Field>
      <Field label="Email" error={err.email}>
        <input name="email" type="email" defaultValue={v("email")} className={inputClass} />
      </Field>
      <Field label="Заметки" error={err.notes} wide>
        <input name="notes" defaultValue={v("notes")} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
