"use client";

import { useState, useTransition } from "react";
import { SALES_STEPS } from "@/lib/sales-map";
import { updateProductStep } from "./actions";

// Шаг планограммы для услуги: сохраняется сразу при выборе
export function StepSelect({ id, value }: { id: string; value: string | null }) {
  const [step, setStep] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="hidden w-48 shrink-0 md:block">
      <select
        aria-label="Шаг планограммы"
        value={step}
        disabled={pending}
        onChange={(e) => {
          const previous = step;
          const next = e.target.value;
          setStep(next);
          setError(null);
          startTransition(async () => {
            const result = await updateProductStep(id, next);
            if (result.error) {
              setStep(previous);
              setError(result.error);
            }
          });
        }}
        className={`w-full rounded-lg border border-slate-200 bg-white py-1 pl-2 text-xs ${step ? "text-slate-700" : "text-slate-400"}`}
      >
        <option value="">Шаг планограммы не выбран</option>
        {Object.entries(SALES_STEPS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
