"use client";

import { Icon } from "@/components/icons";

// Кнопка удаления с подтверждением; icon — компактная корзина для строк таблиц
export function ConfirmDeleteButton({
  action,
  message,
  label = "Удалить",
  icon = false,
}: {
  action: () => Promise<void>;
  message: string;
  label?: string;
  icon?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
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
