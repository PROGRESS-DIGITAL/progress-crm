"use client";

import { useActionState } from "react";
import { inputClass, primaryButton } from "@/components/field";
import { createContractAction } from "@/app/documents/actions";

export function CreateContractForm({
  dealId,
  templates,
  number,
  today,
  again,
}: {
  dealId: string;
  templates: { id: string; name: string }[];
  number: string;
  today: string;
  again: boolean;
}) {
  const [state, action, pending] = useActionState(createContractAction.bind(null, dealId), undefined);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <span className="text-xs text-slate-500">Шаблон</span>
        <select name="templateId" defaultValue={templates[0].id} className={inputClass}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex w-24 flex-col gap-1">
        <span className="text-xs text-slate-500">Номер</span>
        <input name="number" required defaultValue={number} className={inputClass} />
      </label>
      <label className="flex w-40 flex-col gap-1">
        <span className="text-xs text-slate-500">Дата</span>
        <input name="date" type="date" required defaultValue={today} className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Создаю…" : again ? "Ещё один договор" : "Создать договор"}
      </button>
      {state?.error && <p className="w-full text-sm text-rose-600">{state.error}</p>}
    </form>
  );
}
