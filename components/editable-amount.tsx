"use client";

import { useEffect, useRef, useState } from "react";
import { formatRub } from "@/lib/format";
import { inputClass } from "@/components/field";

// Сумма показывается текстом; клик превращает её в поле ввода. Значение уходит в форму через скрытый input
export function EditableAmount({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const n = Math.round(Number(draft.replace(/\s/g, "").replace(",", ".")));
    if (Number.isFinite(n) && n >= 0) onChange(n);
    setEditing(false);
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      {editing ? (
        <input
          ref={inputRef}
          inputMode="numeric"
          aria-label="Сумма, ₽"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className={inputClass}
        />
      ) : (
        <button
          type="button"
          title="Нажмите, чтобы изменить"
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold tabular-nums hover:border-blue-400 hover:bg-blue-50"
        >
          {formatRub(value)} <span className="font-normal text-slate-400">✎</span>
        </button>
      )}
    </>
  );
}
