"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Service } from "@prisma/client";
import { SERVICE_LABELS } from "@/lib/format";
import type { DealFormState } from "./actions";

export type DealValues = {
  title: string;
  clientName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  amount: number;
  service: Service;
  owner: string | null;
  expectedCloseDate: string | null; // YYYY-MM-DD
  lostReason: string | null;
  notes: string | null;
  stageId: string;
};

type Props = {
  action: (prev: DealFormState, formData: FormData) => Promise<DealFormState>;
  stages: { id: string; name: string }[];
  initial?: DealValues;
  submitLabel: string;
};

export function DealForm({ action, stages, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Название сделки" error={err.title} wide>
        <input name="title" defaultValue={initial?.title} required className={input} />
      </Field>
      <Field label="Клиент (компания)" error={err.clientName}>
        <input name="clientName" defaultValue={initial?.clientName} required className={input} />
      </Field>
      <Field label="Контактное лицо" error={err.contactName}>
        <input name="contactName" defaultValue={initial?.contactName ?? ""} className={input} />
      </Field>
      <Field label="Телефон" error={err.phone}>
        <input name="phone" type="tel" defaultValue={initial?.phone ?? ""} className={input} />
      </Field>
      <Field label="Email" error={err.email}>
        <input name="email" type="email" defaultValue={initial?.email ?? ""} className={input} />
      </Field>
      <Field label="Сумма, ₽" error={err.amount}>
        <input
          name="amount"
          type="number"
          min={0}
          step={1}
          defaultValue={initial?.amount ?? 0}
          className={input}
        />
      </Field>
      <Field label="Услуга" error={err.service}>
        <select name="service" defaultValue={initial?.service ?? "WEBSITE"} className={input}>
          {Object.entries(SERVICE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Этап" error={err.stageId}>
        <select name="stageId" defaultValue={initial?.stageId ?? stages[0]?.id} className={input}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ответственный" error={err.owner}>
        <input name="owner" defaultValue={initial?.owner ?? ""} className={input} />
      </Field>
      <Field label="Ожидаемая дата закрытия" error={err.expectedCloseDate}>
        <input
          name="expectedCloseDate"
          type="date"
          defaultValue={initial?.expectedCloseDate ?? ""}
          className={input}
        />
      </Field>
      <Field label="Причина отказа" error={err.lostReason}>
        <input name="lostReason" defaultValue={initial?.lostReason ?? ""} className={input} />
      </Field>
      <Field label="Заметки" error={err.notes} wide>
        <textarea name="notes" rows={4} defaultValue={initial?.notes ?? ""} className={input} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Сохраняю…" : submitLabel}
        </button>
        <Link href="/deals" className="text-sm text-slate-600 hover:text-slate-900">
          Отмена
        </Link>
      </div>
    </form>
  );
}

const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </label>
  );
}
