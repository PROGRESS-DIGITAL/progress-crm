"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { Icon } from "@/components/icons";
import { MAX_FILE_SIZE, fileSize } from "@/lib/tasks";
import { sendMail } from "../actions";

export type ComposeDraft = {
  accountId: string;
  to: string;
  cc: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachments: { id: string; name: string; size: number }[];
};

export function ComposeForm({ accounts, draft }: { accounts: { id: string; email: string }[]; draft: ComposeDraft }) {
  const [state, formAction, pending] = useActionState(sendMail, undefined);
  const [files, setFiles] = useState<File[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  // В ответе курсор встаёт над цитатой, как в почтовых программах
  useEffect(() => {
    if (!draft.to || !body.current) return;
    body.current.focus();
    body.current.setSelectionRange(0, 0);
  }, [draft.to]);

  return (
    <form
      // Без автосброса формы: при ошибке отправки набранное письмо остаётся на месте
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        files.forEach((f) => data.append("files", f));
        startTransition(() => formAction(data));
      }}
      className="grid gap-4"
    >
      {draft.replyTo && <input type="hidden" name="replyTo" value={draft.replyTo} />}
      {accounts.length > 1 ? (
        <Field label="От кого">
          <select name="accountId" defaultValue={draft.accountId} className={inputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="accountId" value={draft.accountId} />
      )}
      <Field label="Кому">
        <input name="to" defaultValue={draft.to} required autoFocus={!draft.to} placeholder="client@company.ru, через запятую" className={inputClass} />
      </Field>
      <Field label="Копия">
        <input name="cc" defaultValue={draft.cc} placeholder="Необязательно" className={inputClass} />
      </Field>
      <Field label="Тема">
        <input name="subject" defaultValue={draft.subject} className={inputClass} />
      </Field>
      <Field label="Письмо">
        <textarea ref={body} name="text" defaultValue={draft.text} rows={14} className={`${inputClass} min-h-60 resize-y leading-relaxed`} />
      </Field>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {draft.attachments.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm">
              <input type="checkbox" name="keep" value={a.id} defaultChecked className="accent-blue-600" />
              <span className="max-w-56 truncate">{a.name}</span>
              <span className="text-xs text-slate-400">{fileSize(a.size)}</span>
            </label>
          ))}
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm">
              <span className="max-w-56 truncate">{f.name}</span>
              <span className="text-xs text-slate-400">{fileSize(f.size)}</span>
              <button
                type="button"
                onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                aria-label={`Убрать ${f.name}`}
                className="text-slate-400 hover:text-rose-600"
              >
                <Icon name="close" size={14} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Icon name="clip" size={16} />
            Прикрепить файл
          </button>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((list) => [...list, ...picked]);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">До {fileSize(MAX_FILE_SIZE)} каждый файл</p>
      </div>
      {state?.error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className={`${primaryButton} flex items-center gap-2`}>
          <Icon name="send" size={16} />
          {pending ? "Отправляю…" : "Отправить"}
        </button>
      </div>
    </form>
  );
}
