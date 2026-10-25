"use client";

import { useActionState, useEffect, useRef } from "react";
import { Icon } from "@/components/icons";
import { sendChatMessage } from "./actions";

export function Composer({ conversationId, disabled }: { conversationId: string; disabled?: string }) {
  const [state, formAction, pending] = useActionState(sendChatMessage.bind(null, conversationId), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.sentAt) {
      formRef.current?.reset();
      textRef.current?.focus();
    }
  }, [state?.sentAt]);

  return (
    <form ref={formRef} action={formAction} className="border-t border-slate-100 p-3">
      {(state?.error || disabled) && <p className="mb-2 text-xs text-rose-600">{state?.error || disabled}</p>}
      <div className="flex items-end gap-2">
        <textarea
          ref={textRef}
          name="text"
          rows={1}
          placeholder="Сообщение"
          aria-label="Сообщение"
          disabled={!!disabled}
          onKeyDown={(e) => {
            // Enter отправляет, Shift+Enter — новая строка
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="max-h-40 min-h-11 w-full min-w-0 flex-1 resize-none rounded-2xl border border-transparent bg-slate-100 px-4 py-2.5 text-sm outline-none [field-sizing:content] focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !!disabled}
          aria-label="Отправить"
          title="Отправить (Enter)"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-60"
        >
          <Icon name="send" size={18} />
        </button>
      </div>
    </form>
  );
}
