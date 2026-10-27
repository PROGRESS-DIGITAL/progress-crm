"use client";

import { useRef } from "react";
import { formatPhone, normalizePhone } from "@/lib/phone";

const countDigits = (s: string) => s.replace(/\D/g, "").length;

// Поле телефона с маской +7 (968) 111-11-11: формат подставляется по мере набора, 8 в начале становится +7.
// Поле неуправляемое, как остальные в формах; курсор после правки остаётся за той же цифрой
export function PhoneInput({ name = "phone", defaultValue, className }: { name?: string; defaultValue?: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={ref}
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+7 (900) 000-00-00"
      defaultValue={normalizePhone(defaultValue ?? "")}
      onInput={(e) => {
        const el = e.currentTarget;
        const caret = el.selectionStart ?? el.value.length;
        const atEnd = caret >= el.value.length;
        const digitsBefore = countDigits(el.value.slice(0, caret));
        const next = formatPhone(el.value);
        if (next === el.value) return;
        el.value = next;
        // Набор в конце — курсор в конец. Правка в середине — курсор после того же числа цифр, что было до него
        let pos = next.length;
        if (!atEnd) {
          let seen = 0;
          for (pos = 0; pos < next.length && seen < digitsBefore; pos++) if (/\d/.test(next[pos])) seen++;
        }
        el.setSelectionRange(pos, pos);
      }}
      className={className}
    />
  );
}
