"use client";

import { useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { RichEditor } from "@/components/rich-editor";
import type { PLACEHOLDER_GROUPS } from "@/lib/contracts/fields";
import type { SaveState } from "../../actions";

export function TemplateEditor({
  action,
  name,
  body,
  placeholders,
}: {
  action: (prev: SaveState, formData: FormData) => Promise<SaveState>;
  name: string;
  body: string;
  placeholders: typeof PLACEHOLDER_GROUPS;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card">
        <div className="min-w-0 flex-1 basis-64">
          <Field label="Название шаблона">
            <input name="name" required defaultValue={name} className={inputClass} />
          </Field>
        </div>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Сохранить шаблон"}
        </button>
        {state?.saved && !pending && <span className="text-sm text-emerald-600">Сохранено</span>}
        {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
      </div>
      <RichEditor name="body" initialHtml={body} placeholders={placeholders} />
    </form>
  );
}
