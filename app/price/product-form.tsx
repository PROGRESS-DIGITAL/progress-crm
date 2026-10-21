"use client";

import { useActionState, useEffect, useRef } from "react";
import { SERVICE_LABELS } from "@/lib/format";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";
import { createProduct } from "./actions";

export function ProductForm({ categories }: { categories: string[] }) {
  const [state, formAction, pending] = useActionState(createProduct, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, undefined, name);

  useEffect(() => {
    if (state?.saved) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-4">
      <Field label="Раздел" error={err.category}>
        <input name="category" list="categories" defaultValue={v("category")} className={inputClass} />
        <datalist id="categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <div className="sm:col-span-3">
        <Field label="Название" error={err.name}>
          <input name="name" defaultValue={v("name")} className={inputClass} />
        </Field>
      </div>
      <Field label="Цена, ₽" error={err.price}>
        <input name="price" type="number" min={0} step={1} defaultValue={v("price")} className={inputClass} />
      </Field>
      <Field label="Единица (час, страница)" error={err.unit}>
        <input name="unit" defaultValue={v("unit")} className={inputClass} />
      </Field>
      <Field label="Направление" error={err.service}>
        <select key={v("service")} name="service" defaultValue={v("service") || "WEBSITE"} className={inputClass}>
          {Object.entries(SERVICE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
        <input key={v("priceFrom")} type="checkbox" name="priceFrom" defaultChecked={v("priceFrom") === "on"} />
        Цена «от»
      </label>
      <div className="sm:col-span-4">
        <Field label="Описание" error={err.description}>
          <input name="description" defaultValue={v("description")} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-4">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Добавить услугу"}
        </button>
      </div>
    </form>
  );
}
