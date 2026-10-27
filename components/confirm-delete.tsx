"use client";

import { useRef } from "react";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";

// Кнопка удаления с подтверждением во всплывающем окне.
// what — что удаляем («сделку «Сайт»»): заголовок будет «Вы точно хотите удалить …?».
// title — свой вопрос для действий, которые не удаление («Отключить …?»). message — пояснение под вопросом.
// icon — компактная корзина для строк таблиц
export function ConfirmDeleteButton({
  action,
  what,
  title,
  message,
  label = "Удалить",
  icon = false,
}: {
  action: () => Promise<void>;
  what?: string;
  title?: string;
  message?: string;
  label?: string;
  icon?: boolean;
}) {
  const confirm = useConfirm();
  const form = useRef<HTMLFormElement>(null);
  const approved = useRef(false);

  return (
    <form
      ref={form}
      action={action}
      onSubmit={(e) => {
        if (approved.current) {
          approved.current = false;
          return;
        }
        e.preventDefault();
        confirm({ title: title ?? `Вы точно хотите удалить ${what ?? "это"}?`, text: message }).then((ok) => {
          if (!ok) return;
          approved.current = true;
          form.current?.requestSubmit();
        });
      }}
    >
      {icon ? (
        <button
          type="submit"
          title={label}
          aria-label={label}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        >
          <Icon name="trash" size={16} />
        </button>
      ) : (
        <button type="submit" className="text-sm text-rose-600 hover:text-rose-800">
          {label}
        </button>
      )}
    </form>
  );
}
