"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type { Service } from "@prisma/client";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";
import { ProductPicker } from "@/components/product-picker";
import type { ProductOption } from "@/lib/queries";

export type DealValues = {
  title: string;
  companyId: string;
  contactId: string | null;
  productId: string | null;
  quantity: number;
  amount: number;
  service: Service;
  salesStep: string | null;
  owner: string | null;
  startDate: string | null; // YYYY-MM-DD
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
  products: ProductOption[];
  initial?: Partial<DealValues>;
  submitLabel: string;
};

export function DealForm({ action, stages, companies, products, initial, submitLabel }: Props) {
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
      <ProductPicker
        // После ошибки пересоздаём, чтобы подхватить введённые значения
        key={JSON.stringify(state?.values ?? null)}
        products={products}
        errors={err}
        initial={{
          productId: v("productId"),
          quantity: Number(v("quantity")) || 1,
          service: (v("service") || "WEBSITE") as Service,
          amount: Number(v("amount")) || 0,
          salesStep: v("salesStep"),
        }}
      />
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
      <Field label="Дата начала" error={err.startDate}>
        <input name="startDate" type="date" defaultValue={v("startDate")} className={inputClass} />
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
