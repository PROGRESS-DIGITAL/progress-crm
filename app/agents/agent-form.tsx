"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { saveAgent } from "./actions";

type Scope = { key: string; label: string; hint: string };
type Values = { name: string; description: string; instructions: string; scopes: string[] };

// Заготовки, с которых удобно начать: дальше всё правится
const TEMPLATES: (Values & { title: string })[] = [
  {
    title: "Финансовый аналитик",
    name: "Финансовый аналитик",
    description: "Следит за выручкой и планом",
    instructions:
      "Сравнивай факт с финмоделью: какой сценарий месяца уже взят и сколько не хватает до следующего. " +
      "Показывай динамику к прошлому месяцу и году. Обращай внимание на неоплаченные счета и поступления без счёта.",
    scopes: ["money", "plan", "sales"],
  },
  {
    title: "Менеджер по продажам",
    name: "Менеджер по продажам",
    description: "Помогает вести сделки и не терять клиентов",
    instructions:
      "Помогай вести воронку: какие сделки зависли, у каких прошла ожидаемая дата оплаты, кому стоит написать или позвонить. " +
      "Предлагай следующий шаг по каждой сделке. Учитывай задачи и последнюю переписку с клиентом.",
    scopes: ["sales", "clients", "work", "comms"],
  },
  {
    title: "Сводка по клиенту",
    name: "Сводка по клиенту",
    description: "Собирает всё о клиенте перед встречей",
    instructions:
      "Когда называют клиента, собери короткую сводку: кто это, какие были сделки и на какую сумму, что оплачено и что нет, " +
      "о чём последняя переписка и какие открыты задачи. В конце предложи, что обсудить на встрече.",
    scopes: ["clients", "comms", "money", "work"],
  },
];

export function AgentForm({ id, initial, scopes, isDefault }: { id: string | null; initial: Values; scopes: Scope[]; isDefault?: boolean }) {
  const [state, formAction, pending] = useActionState(saveAgent.bind(null, id), undefined);
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {!id && (
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
          <h2 className="font-semibold">Начать с заготовки</h2>
          <p className="mt-1 text-sm text-slate-500">Заполнит поля ниже, дальше всё можно поменять</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {TEMPLATES.map(({ title, ...t }) => (
              <button
                key={title}
                type="button"
                onClick={() => setValues(t)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
                  values.name === t.name ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 hover:border-blue-300"
                }`}
              >
                <span className="block font-medium">{title}</span>
                <span className="block text-xs text-slate-500">{t.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Название">
            <input name="name" value={values.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} required className={inputClass} />
          </Field>
          <Field label="Коротко, чем занимается">
            <input
              name="description"
              value={values.description}
              onChange={(e) => set({ description: e.target.value })}
              maxLength={200}
              placeholder="Например: следит за выручкой и планом"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Инструкции">
          <textarea
            name="instructions"
            value={values.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            rows={7}
            maxLength={8000}
            placeholder="Что агент должен делать, на что обращать внимание, как отвечать. Например: «Отвечай таблицей, если сравниваешь месяцы»."
            className={`${inputClass} resize-y text-base sm:text-sm`}
          />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Что агенту можно смотреть в CRM</legend>
          <p className="mt-0.5 mb-2 text-xs text-slate-500">Агент только читает данные и ничего не меняет</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {scopes.map((s) => {
              const checked = values.scopes.includes(s.key);
              return (
                <label
                  key={s.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${checked ? "border-blue-500 bg-blue-50/60" : "border-slate-200"}`}
                >
                  <input
                    type="checkbox"
                    name="scopes"
                    value={s.key}
                    checked={checked}
                    onChange={(e) => set({ scopes: e.target.checked ? [...values.scopes, s.key] : values.scopes.filter((k) => k !== s.key) })}
                    className="mt-0.5 h-4 w-4 accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className="block text-xs text-slate-500">{s.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {isDefault && <p className="text-xs text-slate-500">Это постоянный агент: его нельзя удалить, но можно настроить.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Сохраняю…" : id ? "Сохранить" : "Создать агента"}
          </button>
          <Link href={id ? `/agents/${id}` : "/agents"} className="text-sm text-slate-600 hover:text-slate-900">
            Отмена
          </Link>
          {state?.error && (
            <span role="alert" className="text-sm text-rose-600">
              {state.error}
            </span>
          )}
        </div>
      </section>
    </form>
  );
}
