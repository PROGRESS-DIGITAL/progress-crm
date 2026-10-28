"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { useEnterToSend } from "@/components/enter-to-send";
import { draftChatReply, sendChatMessage } from "./actions";

export function Composer({ conversationId, disabled, aiDraft }: { conversationId: string; disabled?: string; aiDraft?: boolean }) {
  const [state, formAction, pending] = useActionState(sendChatMessage.bind(null, conversationId), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [drafting, startDraft] = useTransition();
  const [draftError, setDraftError] = useState<string | null>(null);
  const enter = useEnterToSend(textRef, () => {
    if (textRef.current?.value.trim()) formRef.current?.requestSubmit();
  });

  useEffect(() => {
    if (state?.sentAt) {
      formRef.current?.reset();
      textRef.current?.focus();
    }
  }, [state?.sentAt]);

  // Черновик от AI агента: подставляется в поле, менеджер правит и отправляет сам
  function draft() {
    setDraftError(null);
    startDraft(async () => {
      const r = await draftChatReply(conversationId);
      if (!r.ok) return setDraftError(r.error);
      const field = textRef.current;
      if (!field) return;
      field.value = r.text;
      field.focus();
      field.setSelectionRange(r.text.length, r.text.length);
      if (r.handoff) setDraftError(`Агент считает, что нужен менеджер: ${r.handoff}`);
    });
  }

  const error = state?.error || disabled || draftError;

  return (
    <form ref={formRef} action={formAction} className="border-t border-slate-100 p-3">
      {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
      <div className="flex items-end gap-2">
        {aiDraft && !disabled && (
          <button
            type="button"
            onClick={draft}
            disabled={drafting}
            aria-label="Ответ AI"
            title="Черновик ответа от AI агента"
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Icon name="bot" size={18} className={drafting ? "animate-pulse" : ""} />
            <span className="hidden sm:inline">{drafting ? "Пишу…" : "Ответ AI"}</span>
          </button>
        )}
        <textarea
          ref={textRef}
          name="text"
          rows={1}
          placeholder="Сообщение"
          aria-label="Сообщение"
          disabled={!!disabled}
          {...enter}
          className="max-h-40 min-h-11 w-full min-w-0 flex-1 resize-none rounded-2xl border border-transparent bg-slate-100 px-4 py-2.5 text-base outline-none [field-sizing:content] focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60 sm:text-sm"
        />
        <button
          type="submit"
          disabled={pending || !!disabled}
          aria-label="Отправить"
          title="Отправить (Enter)"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-60"
        >
          <Icon name="arrowRight" size={20} />
        </button>
      </div>
    </form>
  );
}
