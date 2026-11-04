"use client";

import { useActionState, useEffect, useRef } from "react";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";
import { PhoneInput } from "@/components/phone-input";
import { CopyInput } from "@/components/copy-input";

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
  onSaved,
  onCancel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: ContactValues;
  submitLabel: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, initial, name);

  // После добавления контакта форма очищается под следующий
  useEffect(() => {
    if (state?.saved && !initial) formRef.current?.reset();
    if (state?.saved) onSaved?.();
  }, [state, initial, onSaved]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-2">
      <Field label="Имя" error={err.fullName}>
        <CopyInput>
          <input name="fullName" defaultValue={v("fullName")} required className={inputClass} />
        </CopyInput>
      </Field>
      <Field label="Должность" error={err.position}>
        <CopyInput>
          <input name="position" defaultValue={v("position")} className={inputClass} />
        </CopyInput>
      </Field>
      <Field label="Телефон" error={err.phone}>
        <CopyInput>
          <PhoneInput defaultValue={v("phone")} className={inputClass} />
        </CopyInput>
      </Field>
      <Field label="Email" error={err.email}>
        <CopyInput>
          <input name="email" type="email" defaultValue={v("email")} className={inputClass} />
        </CopyInput>
      </Field>
      <Field label="Заметки" error={err.notes} wide>
        <input name="notes" defaultValue={v("notes")} className={inputClass} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-800">
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}
