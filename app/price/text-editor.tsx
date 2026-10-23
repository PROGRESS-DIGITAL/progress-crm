"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateProductText } from "./actions";

// Название или описание услуги: клик — поле ввода, Enter или уход с поля — сохранить, Esc — отменить
export function TextEditor({
  id,
  field,
  value: initial,
  className,
  placeholder,
}: {
  id: string;
  field: "name" | "description";
  value: string | null;
  className: string;
  placeholder: string;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function save() {
    setEditing(false);
    const next = draft.trim();
    if (next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await updateProductText(id, field, next);
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
        aria-label={field === "name" ? "Название услуги" : "Описание услуги"}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`-mx-1 w-full rounded-md border border-blue-400 px-1 py-0.5 outline-none ring-2 ring-blue-100 ${className}`}
      />
    );
  }
  return (
    <>
      <button
        type="button"
        title={field === "name" ? "Нажмите, чтобы изменить название" : "Нажмите, чтобы изменить описание"}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={`-mx-1 block max-w-full rounded-md border border-transparent px-1 py-0.5 text-left hover:border-dashed hover:border-blue-400 hover:bg-blue-50 ${pending ? "opacity-60" : ""} ${className}`}
      >
        {value || <span className="text-slate-400 italic">{placeholder}</span>}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </>
  );
}
