"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { fieldValue } from "@/lib/forms";
import { Field, inputClass, primaryButton } from "@/components/field";
import { BankFields } from "@/components/bank-fields";
import { lookupInn } from "@/app/clients/actions";
import type { Party } from "@/lib/contracts/fields";
import { saveExecutorAction } from "./actions";
import { PhoneInput } from "@/components/phone-input";

// Логотип для шапки договора: в договоре он шириной до 215 px, храним вдвое крупнее для чёткой печати
async function shrinkImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 430 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function ExecutorForm({ initial }: { initial: Party | null }) {
  const [state, action, pending] = useActionState(saveExecutorAction, undefined);
  const err = state?.errors ?? {};
  const v = (name: string) => fieldValue(state, initial ?? undefined, name);
  const formRef = useRef<HTMLFormElement>(null);
  const [logo, setLogo] = useState(v("logo"));
  const [lookup, setLookup] = useState<{ ok?: string; error?: string } | null>(null);
  const [looking, startLookup] = useTransition();

  function fillByInn() {
    const form = formRef.current;
    if (!form) return;
    const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null;
    startLookup(async () => {
      const result = await lookupInn(input("inn")?.value ?? "");
      if (!result.party) return setLookup({ error: result.error });
      const p = result.party;
      for (const [name, value] of [
        ["name", p.individual ? `ИП ${p.director?.replace(/\s*\(.*\)$/, "") ?? p.name}` : p.name],
        ["inn", p.inn],
        ["kpp", p.kpp],
        ["ogrn", p.ogrn],
        ["address", p.address],
        ["director", p.director],
      ] as const) {
        const el = input(name);
        if (el && value) el.value = value;
      }
      setLookup({ ok: `Найдено: ${p.name}. Проверьте поля и сохраните.` });
    });
  }

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
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
      <Field label="Название в договоре" error={err.name} wide>
        <input name="name" required defaultValue={v("name")} placeholder="ИП Иванов Иван Иванович" className={inputClass} />
      </Field>
      <Field label="КПП (у ИП нет)" error={err.kpp}>
        <input name="kpp" inputMode="numeric" defaultValue={v("kpp")} className={inputClass} />
      </Field>
      <Field label="ОГРН или ОГРНИП" error={err.ogrn}>
        <input name="ogrn" inputMode="numeric" defaultValue={v("ogrn")} className={inputClass} />
      </Field>
      <Field label="Руководитель: ФИО (должность)" error={err.director} wide>
        <input name="director" defaultValue={v("director")} placeholder="Иванов Иван Иванович (директор)" className={inputClass} />
      </Field>
      <Field label="Адрес" error={err.address} wide>
        <input name="address" defaultValue={v("address")} className={inputClass} />
      </Field>
      <BankFields value={v} errors={err} />
      <Field label="Телефон" error={err.phone}>
        <PhoneInput defaultValue={v("phone")} className={inputClass} />
      </Field>
      <Field label="Email" error={err.email}>
        <input name="email" type="email" defaultValue={v("email")} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-slate-700">Логотип для шапки договора</span>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Логотип" className="max-h-14 max-w-[215px] rounded border border-slate-200 bg-white p-1" />
          ) : (
            <span className="text-sm text-slate-500">не загружен</span>
          )}
          <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            {logo ? "Заменить" : "Загрузить картинку"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setLogo(await shrinkImage(file));
              }}
            />
          </label>
          {logo && (
            <button type="button" onClick={() => setLogo("")} className="text-sm text-rose-600 hover:text-rose-800">
              Убрать
            </button>
          )}
        </div>
        <input type="hidden" name="logo" value={logo} />
        {err.logo && <p className="mt-1 text-xs text-rose-600">{err.logo}</p>}
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Сохранить реквизиты"}
        </button>
        {state?.saved && !pending && <span className="text-sm text-emerald-600">Сохранено</span>}
      </div>
    </form>
  );
}
