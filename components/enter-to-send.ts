"use client";

import { useEffect, useRef } from "react";

// Enter в поле сообщения отправляет, Shift+Enter — новая строка.
// На iPhone клавиша «ввод» при включённых подсказках клавиатуры приходит как часть набора слова (isComposing),
// и keydown её не ловит: тогда перехватываем сам перенос строки в нативном beforeinput
export function useEnterToSend(field: React.RefObject<HTMLTextAreaElement | null>, send: () => void) {
  const shift = useRef(false);
  const latest = useRef(send);
  useEffect(() => {
    latest.current = send;
  });

  useEffect(() => {
    const el = field.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      if ((e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") && !shift.current) {
        e.preventDefault();
        latest.current();
      }
      shift.current = false;
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, [field]);

  return {
    enterKeyHint: "send" as const,
    onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key !== "Enter") return;
      shift.current = e.shiftKey;
      if (!e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        latest.current();
      }
    },
  };
}
