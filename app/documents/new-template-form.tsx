"use client";

import { useActionState } from "react";
import { FileDrop } from "@/components/file-drop";
import { Field, inputClass, primaryButton } from "@/components/field";
import { createTemplate } from "./actions";

export function NewTemplateForm() {
  const [state, action, pending] = useActionState(createTemplate, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Название">
        <input name="name" placeholder="Например, договор на SEO" className={inputClass} />
      </Field>
      <FileDrop compact hint="Отпустите, чтобы выбрать файл Word" wrongType="Нужен файл Word .docx" className="-m-2 rounded-xl p-2">
        <Field label="Файл Word (.docx), необязательно">
          <input
            name="file"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm hover:file:bg-slate-200"
          />
        </Field>
      </FileDrop>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Создаю…" : "Создать шаблон"}
        </button>
        {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
      </div>
    </form>
  );
}
