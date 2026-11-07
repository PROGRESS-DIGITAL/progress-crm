"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, inputClass, primaryButton } from "@/components/field";
import { fieldValue, type FormState } from "@/lib/forms";
import { SERVICE_LABELS } from "@/lib/format";

export type SubscriptionValues = {
  companyId: string;
  title: string;
  service: string;
  amount: number;
  billingDay: number;
  startMonth: string;
  endMonth: string | null;
  notes: string | null;
};

export function SubscriptionForm({
  action,
  companies,
  initial,
  editing,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  companies: { id: string; name: string }[];
  initial: Partial<SubscriptionValues>;
  editing: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, initial, name);
  return (
    <form
      action={formAction}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Field label="Клиент" error={err.companyId}>
        <select
          key={v("companyId")}
          name="companyId"
          defaultValue={v("companyId")}
          required
          className={inputClass}
        >
          <option value="">Выберите клиента</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Что входит" error={err.title}>
        <input
          name="title"
          defaultValue={v("title")}
          required
          placeholder="SEO-продвижение"
          className={inputClass}
        />
      </Field>
      <Field label="Направление" error={err.service}>
        <select
          key={v("service")}
          name="service"
          defaultValue={v("service") || "SEO"}
          className={inputClass}
        >
          {Object.entries(SERVICE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Сумма в месяц, ₽" error={err.amount}>
        <input
          name="amount"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          defaultValue={v("amount")}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Счёт выставлять, число месяца" error={err.billingDay}>
        <input
          name="billingDay"
          type="number"
          inputMode="numeric"
          min={1}
          max={28}
          defaultValue={v("billingDay") || "1"}
          required
          className={inputClass}
        />
      </Field>
      <Field label="С какого месяца" error={err.startMonth}>
        <input
          name="startMonth"
          type="month"
          defaultValue={v("startMonth")}
          required
          className={inputClass}
        />
      </Field>
      <Field label="По какой месяц (пусто — бессрочно)" error={err.endMonth}>
        <input
          name="endMonth"
          type="month"
          defaultValue={v("endMonth")}
          className={inputClass}
        />
      </Field>
      <Field label="Заметка" error={err.notes}>
        <input
          name="notes"
          defaultValue={v("notes")}
          placeholder="Например, условия договора"
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : editing ? "Сохранить" : "Добавить абонемент"}
        </button>
        {editing && (
          <Link
            href="/finance?view=subscriptions"
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Отмена
          </Link>
        )}
      </div>
    </form>
  );
}
