"use client";

import { useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { fieldValue } from "@/lib/forms";
import { TILDA_FIELDS, type TildaField, type TildaFieldMap } from "@/lib/tilda";
import { saveFieldMap } from "./actions";

export function FieldMapForm({ fieldMap }: { fieldMap: TildaFieldMap }) {
  const [state, formAction, pending] = useActionState(saveFieldMap, undefined);
  const initial = Object.fromEntries(Object.entries(fieldMap).map(([k, v]) => [k, v.join(", ")]));
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(TILDA_FIELDS) as TildaField[]).map((field) => (
        <Field key={field} label={TILDA_FIELDS[field]} error={err[field]}>
          <input
            key={initial[field]}
            name={field}
            defaultValue={fieldValue(state, initial, field)}
            placeholder="не заполняется"
            className={inputClass}
          />
        </Field>
      ))}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Сохранить поля"}
        </button>
        {state?.saved && <span className="text-sm text-emerald-700">Сохранено, новые заявки разбираются по этим полям</span>}
      </div>
    </form>
  );
}
