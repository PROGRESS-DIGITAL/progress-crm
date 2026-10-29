"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { Icon } from "@/components/icons";
import { MAIL_MAX_TOTAL, textToHtml } from "@/lib/mail/core";
import { MAX_FILE_SIZE, fileSize } from "@/lib/tasks";
import { sendMail } from "../actions";
import { RichEditor } from "./rich-editor";

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
  const [tooBig, setTooBig] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  // Копия нужна редко: поле раскрывается по ссылке в строке «Кому», а в «Ответить всем» видно сразу
  const [showCc, setShowCc] = useState(!!draft.cc);
  const [showBcc, setShowBcc] = useState(false);

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
      <div className="flex flex-col gap-1">
        <label htmlFor="mail-to" className="text-sm font-medium text-slate-700">
          Кому
        </label>
        <div className="relative">
          <input
            id="mail-to"
            name="to"
            defaultValue={draft.to}
            required
            autoFocus={!draft.to}
            placeholder="client@company.ru, через запятую"
            className={`${inputClass} ${showCc && showBcc ? "" : "pr-36"}`}
          />
          <span className="absolute inset-y-0 right-2 flex items-center gap-3 text-sm">
            {!showCc && (
              <button type="button" onClick={() => setShowCc(true)} className="text-blue-600 hover:underline">
                Копия
              </button>
            )}
            {!showBcc && (
              <button type="button" onClick={() => setShowBcc(true)} className="text-blue-600 hover:underline">
                Скрытая
              </button>
            )}
          </span>
        </div>
      </div>
      {showCc && (
        <Field label="Копия">
          <input name="cc" defaultValue={draft.cc} autoFocus={!draft.cc} placeholder="Получатели увидят друг друга" className={inputClass} />
        </Field>
      )}
      {showBcc && (
        <Field label="Скрытая копия">
          <input name="bcc" autoFocus placeholder="Остальные получатели этого адреса не увидят" className={inputClass} />
        </Field>
      )}
      <Field label="Тема">
        <input name="subject" defaultValue={draft.subject} className={inputClass} />
      </Field>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Письмо</span>
        <RichEditor name="html" initialHtml={textToHtml(draft.text)} focusStart={!!draft.to} />
      </div>
      {(draft.attachments.length > 0 || files.length > 0 || tooBig) && (
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
          </div>
          {tooBig && <p className="mt-1.5 text-xs text-rose-600">{tooBig}</p>}
        </div>
      )}
      {state?.error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="submit" disabled={pending} className={`${primaryButton} flex items-center gap-2`}>
          <Icon name="send" size={16} />
          {pending ? "Отправляю…" : "Отправить"}
        </button>
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
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
            e.target.value = "";
            // Большой файл почта всё равно не пропустит: говорим сразу, а не после долгой отправки
            const big = picked.find((f) => f.size > MAX_FILE_SIZE);
            const kept = draft.attachments.reduce((sum, a) => sum + a.size, 0);
            const total = [...files, ...picked].reduce((sum, f) => sum + f.size, kept);
            if (big)
              setTooBig(
                `Файл «${big.name}» весит ${fileSize(big.size)}, а в письмо можно не больше ${fileSize(MAX_FILE_SIZE)}. Большой файл лучше отправить ссылкой на облако`,
              );
            else if (total > MAIL_MAX_TOTAL)
              setTooBig(
                `Вместе файлы весят ${fileSize(total)}, а в одно письмо помещается до ${fileSize(MAIL_MAX_TOTAL)}. Разделите их на несколько писем или отправьте ссылкой на облако`,
              );
            else {
              setTooBig(null);
              setFiles((list) => [...list, ...picked]);
            }
          }}
        />
        <span className="text-xs text-slate-500">
          До {fileSize(MAX_FILE_SIZE)} каждый файл и до {fileSize(MAIL_MAX_TOTAL)} все вместе
        </span>
      </div>
    </form>
  );
}
