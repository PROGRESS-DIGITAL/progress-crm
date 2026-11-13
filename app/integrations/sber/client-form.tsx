"use client";

import { startTransition, useActionState } from "react";
import { FileDrop } from "@/components/file-drop";
import { Field, inputClass, primaryButton } from "@/components/field";
import type { TokenState } from "@/components/token-form";

// Ключи приложения СберБизнес API и сертификат из банка
export function SberClientForm({
  action,
  clientId,
  redirectUri,
  hasCertificate,
}: {
  action: (prev: TokenState, formData: FormData) => Promise<TokenState>;
  clientId: string;
  redirectUri: string;
  hasCertificate: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    // Отправляем без сброса формы: при ошибке введённые ключи и выбранный файл остаются на месте
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <Field label="client_id">
        <input name="clientId" defaultValue={clientId} autoComplete="off" className={inputClass} />
      </Field>
      <Field label="client_secret">
        <input
          name="clientSecret"
          type="password"
          autoComplete="off"
          placeholder={clientId ? "Сохранён, введите новый, чтобы заменить" : "Из СберБизнеса"}
          className={inputClass}
        />
      </Field>
      <FileDrop compact hint="Отпустите, чтобы выбрать сертификат" wrongType="Нужен сертификат .pfx или .p12" className="-m-2 rounded-xl p-2">
        <Field label={hasCertificate ? "Сертификат (загружен, можно заменить)" : "Сертификат .pfx или .p12"}>
          <input name="certificate" type="file" accept=".pfx,.p12" className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1`} />
        </Field>
      </FileDrop>
      <Field label="Пароль сертификата">
        <input name="passphrase" type="password" autoComplete="off" placeholder={hasCertificate ? "Сохранён" : ""} className={inputClass} />
      </Field>
      <Field label="Redirect URI (такой же укажите в настройках приложения в Сбере)" wide>
        <input name="redirectUri" defaultValue={redirectUri} autoComplete="off" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Проверяю…" : "Сохранить ключи"}
        </button>
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
      </div>
    </form>
  );
}
