"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Field, inputClass } from "@/components/field";
import { lookupBic } from "@/app/clients/actions";

type Values = { bankAccount: string; corrAccount: string; bankName: string; bik: string };

// Банковские реквизиты для договоров и счетов: банк и корр. счёт подтягиваются по БИК
export function BankFields({ value, errors = {} }: { value: (name: keyof Values) => string; errors?: Record<string, string | undefined> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [lookup, setLookup] = useState<{ ok?: string; error?: string } | null>(null);
  const [looking, start] = useTransition();

  function fillByBic() {
    const box = ref.current;
    if (!box) return;
    const input = (name: string) => box.querySelector<HTMLInputElement>(`[name="${name}"]`);
    start(async () => {
      const result = await lookupBic(input("bik")?.value ?? "");
      if (!result.bank) {
        setLookup({ error: result.error });
        return;
      }
      const b = result.bank;
      for (const [name, v] of [["bik", b.bik], ["bankName", b.name], ["corrAccount", b.corrAccount]] as const) {
        const el = input(name);
        if (el && v) el.value = v;
      }
      setLookup({ ok: `Найден: ${b.name}.` });
    });
  }

  return (
    <div ref={ref} className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="БИК" error={errors.bik}>
          <div className="flex gap-2">
            <input name="bik" inputMode="numeric" defaultValue={value("bik")} className={inputClass} />
            <button
              type="button"
              onClick={fillByBic}
              disabled={looking}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {looking ? "Ищу…" : "Заполнить по БИК"}
            </button>
          </div>
        </Field>
        {lookup?.ok && <p className="mt-1 text-xs text-emerald-700">{lookup.ok}</p>}
        {lookup?.error === "no-key" ? (
          <p className="mt-1 text-xs text-amber-800">
            Чтобы заполнять по БИК, добавьте ключ DaData в{" "}
            <Link href="/integrations/dadata" className="underline">
              «Интеграциях»
            </Link>
            .
          </p>
        ) : (
          lookup?.error && <p className="mt-1 text-xs text-rose-600">{lookup.error}</p>
        )}
      </div>
      <Field label="Банк" error={errors.bankName} wide>
        <input name="bankName" defaultValue={value("bankName")} className={inputClass} />
      </Field>
      <Field label="Расчётный счёт" error={errors.bankAccount}>
        <input name="bankAccount" inputMode="numeric" defaultValue={value("bankAccount")} className={inputClass} />
      </Field>
      <Field label="Корр. счёт" error={errors.corrAccount}>
        <input name="corrAccount" inputMode="numeric" defaultValue={value("corrAccount")} className={inputClass} />
      </Field>
    </div>
  );
}
