"use client";

export function DeleteDealButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Удалить сделку? Это действие нельзя отменить.")) e.preventDefault();
      }}
    >
      <button type="submit" className="text-sm text-rose-600 hover:text-rose-800">
        Удалить
      </button>
    </form>
  );
}
