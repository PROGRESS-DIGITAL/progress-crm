"use client";

export function ConfirmDeleteButton({
  action,
  message,
  label = "Удалить",
}: {
  action: () => Promise<void>;
  message: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <button type="submit" className="text-sm text-rose-600 hover:text-rose-800">
        {label}
      </button>
    </form>
  );
}
