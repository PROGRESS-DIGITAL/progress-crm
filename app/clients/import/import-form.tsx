"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { inputClass, primaryButton } from "@/components/field";
import { previewImport, type ImportResult } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportResult, FormData>(previewImport, {});
  const [text, setText] = useState("");
  // После правки таблицы старая проверка уже не про неё: кнопка загрузки ждёт новой проверки
  const [dirty, setDirty] = useState(false);
  const preview = state.preview;
  const created = preview?.filter((r) => !r.match).length ?? 0;
  const changes = (r: NonNullable<typeof preview>[number]) => r.fills.length + r.newContacts.length + r.updatedContacts.length > 0;
  const merged = preview?.filter((r) => r.match && changes(r)).length ?? 0;
  const same = preview?.filter((r) => r.match && !changes(r)).length ?? 0;
  const people = preview?.reduce((a, r) => a + r.newContacts.length, 0) ?? 0;

  if (state.done) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <p className="text-sm text-emerald-700">
          Готово: новых клиентов {state.done.created}, дополнено {state.done.merged}, добавлено контактов {state.done.contacts}.
        </p>
        <Link href="/clients" className={`mt-4 inline-block ${primaryButton}`}>
          К клиентам
        </Link>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={() => setDirty(false)} className="flex flex-col gap-4">
      <div className="rounded-2xl bg-white p-4 shadow-card sm:p-6">
        <p className="mb-3 text-sm text-slate-600">
          Скопируйте строки из Excel или Google Таблиц вместе с шапкой и вставьте сюда. Колонки узнаются по шапке: компания, сайт,
          имя, почта, телефон, услуга, сумма, комментарий. Без шапки порядок такой: компания, сайт, услуга, сумма, контакты,
          комментарий. Если клиент уже есть в CRM (совпало название или сайт), его данные не меняются: заполняются только пустые поля,
          услуга и комментарий дописываются в заметку, новые люди добавляются в контакты.
        </p>
        <textarea
          name="table"
          rows={10}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          placeholder={"Компания\tсайт.ru\tУслуга\t25000\tИмя, Имя\tКомментарий"}
          className={`${inputClass} font-mono text-xs`}
          required
        />
        {state.error && <p className="mt-2 text-sm text-rose-600">{state.error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" name="intent" value="preview" disabled={pending || !text.trim()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
            {pending ? "Проверяю…" : "Проверить"}
          </button>
          {preview && !dirty && (
            <button type="submit" name="intent" value="apply" disabled={pending || created + merged === 0} className={primaryButton}>
              {pending ? "Загружаю…" : created + merged === 0 ? "Всё уже есть в CRM" : `Загрузить: ${created} новых, ${merged} дополнить`}
            </button>
          )}
        </div>
      </div>

      {preview && (
        <section className="rounded-2xl bg-white shadow-card">
          <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            Строк: {preview.length}. Новых клиентов {created}, дополнится {merged}, уже есть без изменений {same}, новых контактов {people}. Если что-то
            не так, поправьте таблицу и нажмите «Проверить» ещё раз.
          </p>
          <ul className="divide-y divide-slate-100">
            {preview.map((r, i) => (
              <li key={i} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm sm:flex-row sm:items-baseline sm:gap-4">
                <span className="font-medium text-slate-900 sm:w-64 sm:shrink-0">{r.name}</span>
                <span className={r.match ? "text-amber-700" : "text-emerald-700"}>
                  {r.match
                    ? `Есть в CRM: «${r.match}»${r.fills.length ? `, дополнится ${r.fills.join(", ")}` : changes(r) ? "" : ", без изменений"}`
                    : "Новый клиент"}
                </span>
                {r.newContacts.length > 0 && <span className="text-slate-500">+ {r.newContacts.join(", ")}</span>}
                {r.updatedContacts.length > 0 && (
                  <span className="text-slate-500">почта или телефон: {r.updatedContacts.join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
