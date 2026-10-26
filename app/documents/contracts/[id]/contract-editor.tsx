"use client";

import { useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { RichEditor } from "@/components/rich-editor";
import type { SaveState } from "../../actions";

const secondary = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50";

export function ContractEditor({
  action,
  id,
  number,
  date,
  body,
}: {
  action: (prev: SaveState, formData: FormData) => Promise<SaveState>;
  id: string;
  number: string;
  date: string;
  body: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card print:hidden">
        <div className="w-28">
          <Field label="Номер">
            <input name="number" required defaultValue={number} className={inputClass} />
          </Field>
        </div>
        <div className="w-40">
          <Field label="Дата">
            <input name="date" type="date" required defaultValue={date} className={inputClass} />
          </Field>
        </div>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        <button type="button" onClick={() => window.print()} className={secondary}>
          Печать / PDF
        </button>
        <a href={`/documents/contracts/${id}/word`} className={secondary}>
          Скачать для Word
        </a>
        {state?.saved && !pending && <span className="text-sm text-emerald-600">Сохранено</span>}
        {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
      </div>
      <p className="-mt-2 text-xs text-slate-500 print:hidden">
        Текст правится прямо на листе. Новые номер и дата после сохранения подставятся в текст сами. Перед печатью и скачиванием сохраните правки.
      </p>
      <RichEditor name="body" initialHtml={body} />
    </form>
  );
}
