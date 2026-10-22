"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatRub } from "@/lib/format";
import { updateProductPrice } from "./actions";

// Цена в прайсе: клик — поле ввода, Enter или уход с поля — сохранить, Esc — отменить
export function PriceEditor({
  id,
  price,
  unit,
}: {
  id: string;
  price: number;
  unit: string | null;
}) {
  const [value, setValue] = useState(price);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(price));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function save() {
    setEditing(false);
    const n = Math.round(Number(draft.replace(/\s/g, "").replace(",", ".")));
    if (!Number.isFinite(n) || n < 0) {
      setError("Цена — неотрицательное число");
      return;
    }
    if (n === value) return;
    const previous = value;
    setValue(n);
    setError(null);
    startTransition(async () => {
      const result = await updateProductPrice(id, n);
      if (result.error) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        inputMode="numeric"
        aria-label="Цена, ₽"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-36 rounded-lg border border-blue-400 px-2 py-1 text-right text-sm tabular-nums outline-none ring-2 ring-blue-100"
      />
    );
  }
  return (
    <div className="text-right">
      <button
        type="button"
        title="Нажмите, чтобы изменить цену"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className={`rounded-lg border border-transparent px-2 py-1 text-sm font-semibold whitespace-nowrap tabular-nums hover:border-dashed hover:border-blue-400 hover:bg-blue-50 ${pending ? "opacity-60" : ""}`}
      >
        {formatRub(value)}
        {unit && <span className="font-normal text-slate-500">/{unit}</span>}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
