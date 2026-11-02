"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type { Service } from "@prisma/client";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";
import { ProductPicker } from "@/components/product-picker";
import type { ProductOption } from "@/lib/queries";
import { LOST_REASONS } from "@/lib/deals";

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
  closedAt: string | null; // YYYY-MM-DD
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
  employees: string[];
  initial?: Partial<DealValues>;
  submitLabel: string;
};

// Значение, которого нет в списке (старое или удалённого сотрудника), остаётся выбранным отдельной строкой
function withCurrent(list: readonly string[], current: string) {
  return current && !list.includes(current) ? [...list, current] : list;
}

export function DealForm({ action, stages, companies, products, employees, initial, submitLabel }: Props) {
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
        <select key={v("owner")} name="owner" defaultValue={v("owner")} className={inputClass}>
          <option value="">Не назначен</option>
          {withCurrent(employees, v("owner")).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Дата начала" error={err.startDate}>
        <input name="startDate" type="date" defaultValue={v("startDate")} className={inputClass} />
      </Field>
      <Field label="Ожидаемая дата закрытия" error={err.expectedCloseDate}>
        <input name="expectedCloseDate" type="date" defaultValue={v("expectedCloseDate")} className={inputClass} />
      </Field>
      <Field label="Дата оплаты или закрытия" error={err.closedAt}>
        <input name="closedAt" type="date" defaultValue={v("closedAt")} className={inputClass} />
        <span className="text-xs text-slate-500">Ставится сама при переносе в «Оплачен»; по ней считается выручка месяца</span>
      </Field>
      <Field label="Причина отказа" error={err.lostReason}>
        <select key={v("lostReason")} name="lostReason" defaultValue={v("lostReason")} className={inputClass}>
          <option value="">Не указана</option>
          {withCurrent(LOST_REASONS, v("lostReason")).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
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
