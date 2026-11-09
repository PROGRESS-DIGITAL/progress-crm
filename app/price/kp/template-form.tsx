"use client";

import { useActionState } from "react";
import { Field, inputClass, primaryButton } from "@/components/field";
import { saveTemplateSlides, uploadTemplate } from "./actions";

function Message({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p className="text-sm text-rose-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

export function UploadTemplateForm({ replace }: { replace: boolean }) {
  const [state, action, pending] = useActionState(uploadTemplate, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
          aria-label="PDF с презентацией"
          className="min-w-0 max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
        />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Загружаю…" : replace ? "Заменить" : "Загрузить"}
        </button>
      </div>
      <Message state={state} />
    </form>
  );
}

export function TemplateSlidesForm({
  pages,
  initial,
}: {
  pages: number;
  initial: { cover: number; sample: number | null; intro: string; outro: string };
}) {
  const [state, action, pending] = useActionState(saveTemplateSlides, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Обложка, слайд №">
          <input name="cover" type="number" min={1} max={pages} defaultValue={initial.cover} required className={inputClass} />
          <span className="text-xs text-slate-500">С неё берётся логотип студии слева, остальное CRM пишет сама</span>
        </Field>
        <Field label="Слайды о студии после обложки">
          <input name="intro" defaultValue={initial.intro} placeholder="Например: 2-14" className={inputClass} />
          <span className="text-xs text-slate-500">Услуги, кейсы, рейтинги. Можно через запятую: 2-10, 13</span>
        </Field>
        <Field label="Образец слайда услуги, слайд №">
          <input name="sample" type="number" min={1} max={pages} defaultValue={initial.sample ?? ""} className={inputClass} />
          <span className="text-xs text-slate-500">С него берутся шапка с логотипом и подпись внизу</span>
        </Field>
        <Field label="Слайды в конце">
          <input name="outro" defaultValue={initial.outro} placeholder={`Например: ${pages}`} className={inputClass} />
          <span className="text-xs text-slate-500">Контакты и всё, что идёт после «Стоимости и сроков»</span>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        <a href="/price/kp/sample" target="_blank" rel="noopener" className="text-sm text-blue-600 hover:underline">
          Посмотреть пример КП
        </a>
        <Message state={state} />
      </div>
    </form>
  );
}
