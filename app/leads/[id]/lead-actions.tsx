"use client";

import { useActionState, useState } from "react";
import type { Service } from "@prisma/client";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";
import { ProductPicker } from "@/components/product-picker";
import type { ProductOption } from "@/lib/queries";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function ConvertForm({
  action,
  companies,
  products,
  initial,
}: {
  action: Action;
  companies: { id: string; name: string }[];
  products: ProductOption[];
  initial: { companyId: string; companyName: string; title: string; owner: string; service: Service };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, initial, name);
  const [companyId, setCompanyId] = useState(initial.companyId);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Клиент" error={err.companyId}>
        <select
          key={v("companyId")}
          name="companyId"
          defaultValue={v("companyId")}
          onChange={(e) => setCompanyId(e.target.value)}
          className={inputClass}
        >
          <option value="">Новый клиент</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Название нового клиента" error={err.companyName}>
        <input
          name="companyName"
          defaultValue={v("companyName")}
          disabled={companyId !== ""}
          placeholder={companyId ? "Выбран существующий клиент" : ""}
          className={inputClass}
        />
      </Field>
      <Field label="Название сделки" error={err.title} wide>
        <input name="title" defaultValue={v("title")} required className={inputClass} />
      </Field>
      <ProductPicker
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
      <Field label="Ответственный" error={err.owner}>
        <input name="owner" defaultValue={v("owner")} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Создаю…" : "Создать сделку"}
        </button>
      </div>
    </form>
  );
}

export function RejectForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2">
      <div className="min-w-56 flex-1">
        <input
          name="rejectReason"
          placeholder="Причина: спам, не наш профиль, дорого…"
          defaultValue={fieldValue(state, undefined, "rejectReason")}
          className={inputClass}
        />
        {state?.errors?.rejectReason && <span className="text-xs text-rose-600">{state.errors.rejectReason}</span>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Отклонить
      </button>
    </form>
  );
}
