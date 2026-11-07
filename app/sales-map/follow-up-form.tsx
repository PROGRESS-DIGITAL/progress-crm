"use client";

import { useRef } from "react";
import { inputClass } from "@/components/field";

// Меняется сразу при выборе, без кнопки «Сохранить»
export function FollowUpForm({ action, days, options }: { action: (formData: FormData) => Promise<void>; days: number; options: number[] }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
      <label htmlFor="follow-up-days">Напоминать предложить следующий шаг</label>
      <select
        id="follow-up-days"
        name="days"
        defaultValue={String(days)}
        onChange={() => form.current?.requestSubmit()}
        className={`${inputClass} w-auto py-1.5`}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            через {n} дней после оплаты
          </option>
        ))}
        <option value="0">не напоминать</option>
      </select>
    </form>
  );
}
