"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { fieldValue, type FormState } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";
import { lookupInn } from "./actions";
import { BankFields } from "@/components/bank-fields";
import { SALES_COLUMNS } from "@/lib/sales-map";
import { PhoneInput } from "@/components/phone-input";

export type CompanyValues = {
  name: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  director: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bankAccount: string | null;
  corrAccount: string | null;
  bankName: string | null;
  bik: string | null;
  notes: string | null;
  situation: string | null;
};

export function CompanyForm({
  action,
  initial,
  submitLabel,
  mode = "create",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: CompanyValues;
  submitLabel: string;
  mode?: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, initial, name);
  const formRef = useRef<HTMLFormElement>(null);
  const [lookup, setLookup] = useState<{ ok?: string; error?: string } | null>(null);
  const [looking, startLookup] = useTransition();
  // Вопрос о дубле закрывается «Отменой» и снова появляется при следующей отправке
  const [dismissed, setDismissed] = useState<FormState>(undefined);
  const duplicate = state !== dismissed ? state?.duplicate : undefined;

  // Реквизиты перезаписываются данными ЕГРЮЛ, а название, телефон и email — только если они пустые
  function fillByInn() {
    const form = formRef.current;
    if (!form) return;
    const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null;
    startLookup(async () => {
      const result = await lookupInn(input("inn")?.value ?? "");
      if (!result.party) {
        setLookup({ error: result.error });
        return;
      }
      const p = result.party;
      const set = (name: string, value: string | null, onlyIfEmpty = false) => {
        const el = input(name);
        if (el && value && (!onlyIfEmpty || !el.value.trim())) el.value = value;
      };
      // Менеджер должен видеть, чего DaData не прислала, а не гадать, почему поле пустое
      const missing = [
        !p.individual && !p.kpp && "КПП",
        !p.address && "адрес",
        !p.director && "руководитель",
        !p.phone && "телефон",
        !p.email && "email",
      ].filter(Boolean);
      set("inn", p.inn);
      set("kpp", p.kpp);
      set("ogrn", p.ogrn);
      set("address", p.address);
      set("director", p.director);
      set("name", p.name, true);
      set("phone", p.phone, true);
      set("email", p.email, true);
      setLookup({
        ok: [
          `Найдено: ${p.name}.`,
          p.inactive && "Внимание: компания не действует.",
          p.individual && "У ИП нет КПП.",
          missing.length > 0 && `DaData не прислала: ${missing.join(", ")}.`,
          "Проверьте поля и сохраните.",
        ]
          .filter(Boolean)
          .join(" "),
      });
    });
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Название компании" error={err.name} wide>
        <input name="name" defaultValue={v("name")} required className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="ИНН" error={err.inn}>
          <div className="flex gap-2">
            <input name="inn" inputMode="numeric" defaultValue={v("inn")} className={inputClass} />
            <button
              type="button"
              onClick={fillByInn}
              disabled={looking}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {looking ? "Ищу…" : "Заполнить по ИНН"}
            </button>
          </div>
        </Field>
        {lookup?.ok && <p className="mt-1 text-xs text-emerald-700">{lookup.ok}</p>}
        {lookup?.error === "no-key" ? (
          <p className="mt-1 text-xs text-amber-800">
            Чтобы заполнять по ИНН, добавьте ключ DaData в{" "}
            <Link href="/integrations/dadata" className="underline">
              «Интеграциях»
            </Link>
            .
          </p>
        ) : (
          lookup?.error && <p className="mt-1 text-xs text-rose-600">{lookup.error}</p>
        )}
      </div>
      <Field label="КПП" error={err.kpp}>
        <input name="kpp" inputMode="numeric" defaultValue={v("kpp")} className={inputClass} />
      </Field>
      <Field label="ОГРН" error={err.ogrn}>
        <input name="ogrn" inputMode="numeric" defaultValue={v("ogrn")} className={inputClass} />
      </Field>
      <Field label="Руководитель" error={err.director} wide>
        <input name="director" defaultValue={v("director")} className={inputClass} />
      </Field>
      <Field label="Сайт" error={err.website}>
        <input name="website" defaultValue={v("website")} className={inputClass} />
      </Field>
      <Field label="Телефон" error={err.phone}>
        <PhoneInput defaultValue={v("phone")} className={inputClass} />
      </Field>
      <Field label="Email" error={err.email}>
        <input name="email" type="email" defaultValue={v("email")} className={inputClass} />
      </Field>
      <Field label="Адрес" error={err.address} wide>
        <input name="address" defaultValue={v("address")} className={inputClass} />
      </Field>
      <BankFields value={v} errors={err} />
      <Field label="Что есть у клиента (планограмма)" error={err.situation} wide>
        <select key={v("situation")} name="situation" defaultValue={v("situation")} className={inputClass}>
          <option value="">Определить по оплаченным сделкам</option>
          {SALES_COLUMNS.map((c) => (
            <option key={c.situation} value={c.situation}>
              {c.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Заметки" error={err.notes} wide>
        <textarea name="notes" rows={3} defaultValue={v("notes")} className={inputClass} />
      </Field>
      {duplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="dup-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="dup-title" className="text-lg font-semibold">
              Найден такой же клиент
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              <Link href={`/clients/${duplicate.id}`} target="_blank" className="font-medium text-blue-700 hover:underline">
                {duplicate.name}
              </Link>
              {duplicate.inn && <span className="text-slate-500"> · ИНН {duplicate.inn}</span>}
              <br />
              <span className="text-slate-500">
                {duplicate.reason === "inn" ? "Совпадает ИНН." : "Совпадает название."}
              </span>
            </p>
            <p className="mt-3 text-sm text-slate-700">
              {mode === "create"
                ? "Объединить данные? Новый клиент не появится: пустые поля найденного заполнятся тем, что вы ввели."
                : "Объединить данные? Его сделки и контакты перейдут к этому клиенту, пустые поля заполнятся, а дубль удалится."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                name="duplicateChoice"
                value={`merge:${duplicate.id}`}
                disabled={pending}
                className={primaryButton}
              >
                Объединить
              </button>
              <button
                type="submit"
                name="duplicateChoice"
                value="separate"
                disabled={pending}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                {mode === "create" ? "Создать отдельно" : "Сохранить отдельно"}
              </button>
              <button
                type="button"
                onClick={() => setDismissed(state)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : submitLabel}
        </button>
        {state?.saved && !pending && <span className="text-sm text-emerald-600">Сохранено</span>}
      </div>
    </form>
  );
}
