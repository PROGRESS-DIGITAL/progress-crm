"use client";

import { startTransition, useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { CopyField } from "@/components/copy-field";
import { useConfirm } from "@/components/confirm-dialog";
import { createEmployee, resetEmployeeCode, resetEmployeePassword, saveRole, setEmployeeRole, type EmployeeState } from "./actions";

type RoleOption = { id: string; name: string };

// Временный пароль показывается один раз: директор копирует его и передаёт сотруднику
function TempPassword({ temp }: { temp: NonNullable<NonNullable<EmployeeState>["temp"]> }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
      <p>
        Передайте сотруднику «{temp.name}» логин <b>{temp.login}</b> и временный пароль. Пароль показывается один раз; при первом входе сотрудник
        придумает свой и подключит код из приложения.
      </p>
      <CopyField value={temp.password} label="Временный пароль" />
    </div>
  );
}

export function AddEmployeeForm({ roles }: { roles: RoleOption[] }) {
  const [state, action, pending] = useActionState(createEmployee, undefined);
  return (
    <div className="flex flex-col gap-3">
      <form
        action={action}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end"
      >
        <Field label="Имя">
          <input name="name" required className={inputClass} />
        </Field>
        <Field label="Должность">
          <input name="position" placeholder="Менеджер проектов" className={inputClass} />
        </Field>
        <Field label="Логин">
          <input name="login" required autoCapitalize="none" placeholder="латиницей, например anna" className={inputClass} />
        </Field>
        <Field label="Роль">
          <select name="roleId" defaultValue={roles[0]?.id ?? ""} className={inputClass}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            <option value="">Без роли — разделы закрыты</option>
          </select>
        </Field>
        <button type="submit" disabled={pending} className={`${primaryButton} h-[38px]`}>
          {pending ? "Добавляю…" : "Добавить"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state?.temp && <TempPassword temp={state.temp} />}
    </div>
  );
}

// Роль меняется сразу при выборе в списке
export function RoleSelect({ id, roleId, roles }: { id: string; roleId: string | null; roles: RoleOption[] }) {
  return (
    <form action={setEmployeeRole.bind(null, id)}>
      <select
        name="roleId"
        aria-label="Роль"
        defaultValue={roleId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`${inputClass} sm:w-48`}
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
        <option value="">Без роли</option>
      </select>
    </form>
  );
}

// Сброс пароля и кода: оба спрашивают подтверждение, потому что закрывают все входы сотрудника
export function EmployeeTools({ id, name }: { id: string; name: string }) {
  const confirm = useConfirm();
  const [pass, passAction, passPending] = useActionState(async () => resetEmployeePassword(id), undefined);
  const [code, codeAction, codePending] = useActionState(async () => resetEmployeeCode(id), undefined);
  const ask = (title: string, text: string, run: () => void) => async (e: React.FormEvent) => {
    e.preventDefault();
    if (await confirm({ title, text, ok: "Сбросить" })) startTransition(run);
  };
  return (
    <>
      <form onSubmit={ask(`Сбросить пароль сотрудника «${name}»?`, "Он выйдет на всех устройствах и войдёт с новым временным паролем.", passAction)}>
        <button type="submit" disabled={passPending} className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-60">
          Сбросить пароль
        </button>
      </form>
      <form onSubmit={ask(`Сбросить код входа сотрудника «${name}»?`, "Например, если он потерял телефон. При входе он подключит приложение заново.", codeAction)}>
        <button type="submit" disabled={codePending} className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-60">
          Сбросить код
        </button>
      </form>
      {pass?.temp && (
        <div className="w-full">
          <TempPassword temp={pass.temp} />
        </div>
      )}
      {code?.ok && <p className="w-full text-sm text-emerald-700">{code.ok}</p>}
    </>
  );
}

export function RoleForm({
  role,
  sections,
}: {
  role: { id: string; name: string; sections: string[] } | null;
  sections: { key: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(saveRole.bind(null, role?.id ?? null), undefined);
  return (
    <form action={action} className="flex flex-1 flex-col gap-3">
      <input
        name="name"
        required
        defaultValue={role?.name}
        placeholder="Новая роль"
        aria-label="Название роли"
        className={`${inputClass} font-medium`}
      />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {sections.map((s) => (
          <label key={s.key} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="sections" value={s.key} defaultChecked={role?.sections.includes(s.key)} className="h-4 w-4 rounded border-slate-300" />
            {s.label}
          </label>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : role ? "Сохранить" : "Добавить роль"}
        </button>
        {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      </div>
    </form>
  );
}
