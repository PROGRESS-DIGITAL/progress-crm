"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type { Service } from "@prisma/client";
import { SERVICE_LABELS } from "@/lib/format";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";

export type DealValues = {
  title: string;
  companyId: string;
  contactId: string | null;
  amount: number;
  service: Service;
  owner: string | null;
  expectedCloseDate: string | null; // YYYY-MM-DD
  lostReason: string | null;
  notes: string | null;
  stageId: string;
};

export type CompanyOption = {
  id: string;
  name: string;
  contacts: { id: string; fullName: string }[];
};

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  stages: { id: string; name: string }[];
  companies: CompanyOption[];
  initial?: Partial<DealValues>;
  submitLabel: string;
};

export function DealForm({ action, stages, companies, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [companyId, setCompanyId] = useState(initial?.companyId ?? "");
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, initial, name);
  const contacts = companies.find((c) => c.id === companyId)?.contacts ?? [];

  // После ошибки React сбрасывает форму к defaultValue — список контактов следует за ней
  useEffect(() => {
    if (state?.values) setCompanyId(state.values.companyId ?? "");
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Название сделки" error={err.title} wide>
        <input name="title" defaultValue={v("title")} required className={inputClass} />
      </Field>
      <Field label="Клиент" error={err.companyId}>
        <select
          key={v("companyId")}
          name="companyId"
          defaultValue={v("companyId")}
          onChange={(e) => setCompanyId(e.target.value)}
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
        <Link href="/clients/new" className="text-xs text-blue-600 hover:underline">
          + Новый клиент
        </Link>
      </Field>
      <Field label="Контакт" error={err.contactId}>
        {/* key: смена клиента сбрасывает контакт; select не подхватывает новый defaultValue без пересоздания */}
        <select
          key={`${companyId}-${v("contactId")}`}
          name="contactId"
          defaultValue={companyId === (state?.values?.companyId ?? initial?.companyId) ? v("contactId") : ""}
          disabled={!companyId}
          className={inputClass}
        >
          <option value="">{contacts.length ? "Без контакта" : "У клиента нет контактов"}</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Сумма, ₽" error={err.amount}>
        <input name="amount" type="number" min={0} step={1} defaultValue={v("amount") || "0"} className={inputClass} />
      </Field>
      <Field label="Услуга" error={err.service}>
        <select key={v("service")} name="service" defaultValue={v("service")} className={inputClass}>
          {Object.entries(SERVICE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Этап" error={err.stageId}>
        <select key={v("stageId")} name="stageId" defaultValue={v("stageId")} className={inputClass}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ответственный" error={err.owner}>
        <input name="owner" defaultValue={v("owner")} className={inputClass} />
      </Field>
      <Field label="Ожидаемая дата закрытия" error={err.expectedCloseDate}>
        <input name="expectedCloseDate" type="date" defaultValue={v("expectedCloseDate")} className={inputClass} />
      </Field>
      <Field label="Причина отказа" error={err.lostReason}>
        <input name="lostReason" defaultValue={v("lostReason")} className={inputClass} />
      </Field>
      <Field label="Заметки" error={err.notes} wide>
        <textarea name="notes" rows={4} defaultValue={v("notes")} className={inputClass} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : submitLabel}
        </button>
        <Link href="/deals" className="text-sm text-slate-600 hover:text-slate-900">
          Отмена
        </Link>
      </div>
    </form>
  );
}
