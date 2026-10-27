"use client";

import { useActionState, useState } from "react";
import type { MailProvider } from "@prisma/client";
import { Field, inputClass, primaryButton } from "@/components/field";
import { detectProvider, PROVIDERS } from "@/lib/mail/core";
import { connectMailbox } from "./actions";

export function MailboxForm() {
  const [state, formAction, pending] = useActionState(connectMailbox, undefined);
  const v = state?.values;
  const [provider, setProvider] = useState<MailProvider>((v?.provider as MailProvider) || "YANDEX");

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Где почта</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PROVIDERS) as MailProvider[]).map((p) => (
            <label
              key={p}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${
                provider === p ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} className="sr-only" />
              {PROVIDERS[p].label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Адрес почты">
        <input
          name="email"
          type="email"
          required
          defaultValue={v?.email}
          placeholder={provider === "GMAIL" ? "studio@gmail.com" : "studio@yandex.ru"}
          autoComplete="off"
          // По адресу на gmail.com или yandex.ru сервис выбирается сам; свой домен оставляет выбор как есть
          onChange={(e) => {
            const p = detectProvider(e.target.value);
            if (p) setProvider(p);
          }}
          className={inputClass}
        />
      </Field>
      <Field label="Имя отправителя">
        <input name="name" defaultValue={v?.name} placeholder="PROGRESS Digital" className={inputClass} />
      </Field>
      <Field label="Пароль приложения" error={state?.error} wide>
        <input name="password" type="password" required autoComplete="new-password" placeholder={PROVIDERS[provider].passwordHint} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Проверяю вход…" : "Подключить ящик"}
        </button>
      </div>
    </form>
  );
}
