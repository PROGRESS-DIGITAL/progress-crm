"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { inputClass, primaryButton } from "@/components/field";
import { formatRub } from "@/lib/format";
import { saveManagerPlan } from "./actions";

// План менеджера в карточке: показывается суммой, по клику превращается в поле
export function PlanForm({ owner, month, plan }: { owner: string; month: string; plan: number }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveManagerPlan, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Изменить план"
        className="rounded-lg px-1.5 py-0.5 text-left text-sm text-slate-500 hover:bg-blue-50 hover:text-blue-700"
      >
        {plan > 0 ? (
          <>
            из плана <span className="font-medium text-slate-700 tabular-nums">{formatRub(plan)}</span> ✎
          </>
        ) : (
          <span className="text-blue-600">+ Поставить план</span>
        )}
      </button>
    );
  }

  return (
    <form action={action} className="mt-1 flex w-full flex-col gap-1.5">
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="month" value={month} />
      <div className="flex gap-2">
        <input
          ref={inputRef}
          name="amount"
          inputMode="numeric"
          aria-label="План на месяц, ₽"
          placeholder="План, ₽"
          defaultValue={plan || ""}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className={`${inputClass} min-w-0 flex-1 tabular-nums`}
        />
        <button type="submit" disabled={pending} className={primaryButton}>
          Сохранить
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Отмена
        </button>
      </div>
      <p className={`text-xs ${state?.error ? "text-rose-600" : "text-slate-500"}`}>
        {state?.error ?? "План действует в этом и следующих месяцах, пока его не поменяют. Пустое поле снимает план."}
      </p>
    </form>
  );
}

// Поставить план сотруднику, у которого в этом месяце ещё нет ни плана, ни сделок
export function AddPlanForm({ month, names }: { month: string; names: string[] }) {
  const [state, action, pending] = useActionState(saveManagerPlan, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="month" value={month} />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto]">
        <select name="owner" required defaultValue="" aria-label="Сотрудник" className={inputClass}>
          <option value="" disabled>
            Сотрудник
          </option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <input name="amount" inputMode="numeric" required placeholder="План, ₽" aria-label="План на месяц, ₽" className={`${inputClass} tabular-nums`} />
        <button type="submit" disabled={pending} className={primaryButton}>
          Поставить план
        </button>
      </div>
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
    </form>
  );
}
