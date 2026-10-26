"use client";

import { useEffect, useRef, useState } from "react";

type Group = { title: string; fields: { key: string; label: string }[] };

// Иконки выравнивания и списков: линии разной длины, как в Word
const lines = (rows: [number, number][]) => rows.map(([x1, x2], i) => `M${x1} ${5 + i * 4.5}h${x2 - x1}`).join("");
const ICONS: Record<string, string> = {
  insertUnorderedList: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  insertOrderedList: "M10 6h10M10 12h10M10 18h10M4 4.5l1.2-.5v4M3.8 13.8a1.3 1.3 0 1 1 2 1L4 17h2.3",
  justifyLeft: lines([[4, 20], [4, 14], [4, 20], [4, 12]]),
  justifyCenter: lines([[4, 20], [7, 17], [4, 20], [8, 16]]),
  justifyRight: lines([[4, 20], [10, 20], [4, 20], [12, 20]]),
  justifyFull: lines([[4, 20], [4, 20], [4, 20], [4, 20]]),
};

const TOOLS: { cmd: string; label: string; title: string; className?: string }[] = [
  { cmd: "bold", label: "Ж", title: "Жирный", className: "font-bold" },
  { cmd: "italic", label: "К", title: "Курсив", className: "italic" },
  { cmd: "underline", label: "Ч", title: "Подчёркнутый", className: "underline" },
  { cmd: "insertUnorderedList", label: "", title: "Список" },
  { cmd: "insertOrderedList", label: "", title: "Нумерованный список" },
  { cmd: "justifyLeft", label: "", title: "По левому краю" },
  { cmd: "justifyCenter", label: "", title: "По центру" },
  { cmd: "justifyRight", label: "", title: "По правому краю" },
  { cmd: "justifyFull", label: "", title: "По ширине" },
  { cmd: "removeFormat", label: "Tx", title: "Убрать оформление", className: "line-through" },
];

// Редактор документа «как в Word»: правка прямо на листе, HTML уходит в форму через скрытое поле
export function RichEditor({ name, initialHtml, placeholders }: { name: string; initialHtml: string; placeholders?: Group[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const saved = useRef<Range | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    if (hidden.current) hidden.current.value = initialHtml;
  }, [initialHtml]);

  // Меню полей закрывается кликом мимо него
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const sync = () => {
    if (hidden.current && ref.current) hidden.current.value = ref.current.innerHTML;
  };

  const remember = () => {
    const sel = window.getSelection();
    if (sel?.rangeCount && ref.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
  };

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    if (saved.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(saved.current);
    }
    document.execCommand(cmd, false, arg);
    sync();
    remember();
  };

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur print:hidden">
        <select
          aria-label="Стиль абзаца"
          className="h-8 rounded-lg border border-slate-200 bg-white py-0 pl-2 text-sm"
          defaultValue=""
          onMouseDown={remember}
          onChange={(e) => {
            run("formatBlock", e.target.value);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Стиль
          </option>
          <option value="p">Обычный текст</option>
          <option value="h2">Заголовок</option>
          <option value="h3">Подзаголовок</option>
        </select>
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.title}
            aria-label={t.title}
            onMouseDown={(e) => {
              e.preventDefault();
              run(t.cmd);
            }}
            className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm text-slate-700 hover:bg-slate-100 ${t.className ?? ""}`}
          >
            {ICONS[t.cmd] ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d={ICONS[t.cmd]} />
              </svg>
            ) : (
              t.label
            )}
          </button>
        ))}
        {placeholders && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                remember();
                setMenu((m) => !m);
              }}
              className="h-8 rounded-lg bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              Вставить поле
            </button>
            {menu && (
              <div className="absolute left-0 z-20 mt-1 max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl">
                {placeholders.map((g) => (
                  <div key={g.title} className="mb-2">
                    <p className="px-2 py-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">{g.title}</p>
                    {g.fields.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setMenu(false);
                          run("insertText", `{{${f.key}}}`);
                        }}
                        className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-slate-100 p-2 sm:p-6">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          onKeyUp={remember}
          onMouseUp={remember}
          className="contract-doc print-area mx-auto min-h-[60vh] max-w-[210mm] bg-white p-5 shadow-card outline-none sm:p-[20mm]"
        />
      </div>
      <input ref={hidden} type="hidden" name={name} />
    </div>
  );
}
