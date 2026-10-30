"use client";

import { useActionState, useState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { cancelLogin, confirmTotp, sendTelegramCode, setNewPassword, setupOwner, signIn, verifyCode, type LoginState } from "./actions";

function Message({ state }: { state: LoginState }) {
  if (state?.error) return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>;
  if (state?.ok) return <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</p>;
  return null;
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" disabled={pending} className={`${primaryButton} h-11 w-full`}>
      {pending ? "Подождите…" : label}
    </button>
  );
}

// Поле пароля с кнопкой «показать»: на телефоне длинный пароль легко ввести с ошибкой
function Password({ name, label, autoComplete, autoFocus }: { name: string; label: string; autoComplete: string; autoFocus?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label}>
      <span className="relative">
        <input
          name={name}
          type={shown ? "text" : "password"}
          required
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={`${inputClass} h-11 pr-24`}
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          {shown ? "Скрыть" : "Показать"}
        </button>
      </span>
    </Field>
  );
}

function CodeInput({ autoFocus = true }: { autoFocus?: boolean }) {
  return (
    <input
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      required
      autoFocus={autoFocus}
      placeholder="000000"
      aria-label="Код из 6 цифр"
      className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.4em]`}
    />
  );
}

function Remember() {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700">
      <input type="checkbox" name="remember" defaultChecked className="mt-0.5 h-4 w-4 rounded border-slate-300" />
      <span>
        Запомнить это устройство на 30 дней
        <span className="block text-xs text-slate-500">Код не будет спрашиваться. Не отмечайте на чужом компьютере.</span>
      </span>
    </label>
  );
}

function Cancel() {
  return (
    <form action={cancelLogin} className="mt-4 text-center">
      <button type="submit" className="text-sm text-slate-500 hover:text-slate-800">
        Войти под другим логином
      </button>
    </form>
  );
}

export function SetupForm({ keyRequired }: { keyRequired: boolean }) {
  const [state, action, pending] = useActionState(setupOwner, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {keyRequired && (
        <Field label="Ключ установки">
          <input name="setupKey" required autoComplete="off" className={`${inputClass} h-11 font-mono`} />
          <span className="text-xs text-slate-500">Напечатан в конце установки CRM на сервере.</span>
        </Field>
      )}
      <Field label="Ваше имя">
        <input name="name" required defaultValue={state?.values?.name} autoComplete="name" className={`${inputClass} h-11`} />
      </Field>
      <Field label="Логин">
        <input
          name="login"
          required
          defaultValue={state?.values?.login}
          autoComplete="username"
          autoCapitalize="none"
          placeholder="например, ilya"
          className={`${inputClass} h-11`}
        />
      </Field>
      <Password name="password" label="Пароль, не короче 10 символов, с буквами и цифрами" autoComplete="new-password" />
      <Password name="password2" label="Пароль ещё раз" autoComplete="new-password" />
      <Message state={state} />
      <Submit pending={pending} label="Продолжить" />
    </form>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Логин">
        <input
          name="login"
          required
          autoFocus
          defaultValue={state?.values?.login}
          autoComplete="username"
          autoCapitalize="none"
          className={`${inputClass} h-11`}
        />
      </Field>
      <Password name="password" label="Пароль" autoComplete="current-password" />
      <Message state={state} />
      <Submit pending={pending} label="Войти" />
    </form>
  );
}

export function CodeForm({ next, telegram }: { next: string; telegram: boolean }) {
  const [state, action, pending] = useActionState(verifyCode, undefined);
  const [tg, tgAction, tgPending] = useActionState(sendTelegramCode, undefined);
  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <CodeInput />
        <Remember />
        <Message state={state} />
        <Submit pending={pending} label="Войти" />
      </form>
      {telegram && (
        <form action={tgAction} className="mt-4 flex flex-col items-center gap-2 border-t border-slate-100 pt-4">
          <p className="text-center text-sm text-slate-600">Нет телефона с приложением под рукой?</p>
          <button
            type="submit"
            disabled={tgPending}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {tgPending ? "Отправляю…" : "Прислать код в Telegram"}
          </button>
          <Message state={tg} />
        </form>
      )}
      <Cancel />
    </>
  );
}

export function TotpSetupForm({ qrSvg, secret, url, next }: { qrSvg: string; secret: string; url: string; next: string }) {
  const [state, action, pending] = useActionState(confirmTotp, undefined);
  return (
    <>
      <ol className="mb-4 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-slate-700">
        <li>
          Установите на телефон приложение для кодов: Яндекс Ключ, Google Authenticator или любое похожее.
        </li>
        <li>В приложении нажмите «Добавить» и отсканируйте QR-код.</li>
        <li>Введите 6 цифр, которые покажет приложение.</li>
      </ol>
      <div className="mx-auto mb-3 w-48 rounded-2xl border border-slate-200 bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <details className="mb-4 text-sm text-slate-600">
        <summary className="cursor-pointer text-center text-blue-600">Не получается отсканировать?</summary>
        <p className="mt-2">Введите ключ в приложении вручную:</p>
        <p className="mt-1 rounded-xl bg-slate-100 px-3 py-2 text-center font-mono text-sm break-all select-all">{secret.match(/.{1,4}/g)?.join(" ")}</p>
        <a href={url} className="mt-2 block text-center text-blue-600 sm:hidden">
          Открыть в приложении на этом телефоне
        </a>
      </details>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <CodeInput autoFocus={false} />
        <Remember />
        <Message state={state} />
        <Submit pending={pending} label="Подключить и войти" />
      </form>
      <Cancel />
    </>
  );
}

export function NewPasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(setNewPassword, undefined);
  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Password name="password" label="Новый пароль, не короче 10 символов, с буквами и цифрами" autoComplete="new-password" autoFocus />
        <Password name="password2" label="Новый пароль ещё раз" autoComplete="new-password" />
        <Message state={state} />
        <Submit pending={pending} label="Сохранить пароль" />
      </form>
      <Cancel />
    </>
  );
}
