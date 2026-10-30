"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/field";

const TOOLS = [
  {
    cmd: "bold",
    label: "Жирный",
    hint: "⌘B",
    text: "Ж",
    className: "font-bold",
  },
  {
    cmd: "italic",
    label: "Курсив",
    hint: "⌘I",
    text: "К",
    className: "italic font-serif",
  },
  {
    cmd: "underline",
    label: "Подчёркнутый",
    hint: "⌘U",
    text: "Ч",
    className: "underline underline-offset-2",
  },
  {
    cmd: "strikeThrough",
    label: "Зачёркнутый",
    hint: "",
    text: "З",
    className: "line-through",
  },
] as const;

type Cmd = (typeof TOOLS)[number]["cmd"];

// Ссылка без http:// всё равно должна открываться, а адрес почты — открывать письмо
function normalizeUrl(raw: string) {
  const url = raw.trim();
  if (!url) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(url)) return `mailto:${url}`;
  return `https://${url}`;
}

// Текст письма с оформлением: жирный, курсив, подчёркнутый, зачёркнутый и ссылки.
// Содержимое уходит в форму скрытым полем html; вставка из буфера идёт простым текстом, чтобы не тащить чужие стили
export function RichEditor({ name, initialHtml, focusStart }: { name: string; initialHtml: string; focusStart?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const [html, setHtml] = useState(initialHtml);
  const [active, setActive] = useState<Partial<Record<Cmd | "link", boolean>>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = initialHtml;
    if (focusStart) {
      // В ответе курсор встаёт над подписью и цитатой, как в почтовых программах
      el.focus();
      const r = document.createRange();
      r.setStart(el, 0);
      r.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
    // Черновик задаётся один раз при открытии, дальше текст живёт в самом редакторе
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onSelection() {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      if (!node || !box.current?.contains(node)) return;
      const el = node instanceof Element ? node : node.parentElement;
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        link: !!el?.closest("a"),
      });
    }
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  function sync() {
    setHtml(box.current?.innerHTML ?? "");
  }

  function run(cmd: string, value?: string) {
    box.current?.focus();
    document.execCommand(cmd, false, value);
    sync();
    document.dispatchEvent(new Event("selectionchange"));
  }

  function openLink() {
    const sel = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    saved.current = range && box.current?.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
    const a = (
      range?.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range?.commonAncestorContainer.parentElement
    )?.closest("a");
    setUrl(a?.getAttribute("href")?.replace(/^mailto:/, "") ?? "");
    setLinkOpen(true);
  }

  function restore() {
    const el = box.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    if (saved.current) sel?.addRange(saved.current);
    else {
      // Курсора в тексте не было: ссылка встанет в конец письма
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel?.addRange(r);
    }
  }

  function applyLink() {
    const href = normalizeUrl(url);
    setLinkOpen(false);
    restore();
    if (!href) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) run("createLink", href);
    else {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = url.trim();
      run("insertHTML", a.outerHTML);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2 py-1.5" role="toolbar" aria-label="Оформление текста">
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.hint ? `${t.label} (${t.hint})` : t.label}
            aria-label={t.label}
            aria-pressed={!!active[t.cmd]}
            // Кнопка не забирает фокус: выделение в тексте остаётся на месте
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.cmd)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${t.className} ${
              active[t.cmd] ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.text}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button
          type="button"
          title="Ссылка"
          aria-label="Ссылка"
          aria-pressed={!!active.link}
          onMouseDown={(e) => e.preventDefault()}
          onClick={openLink}
          className={`flex h-8 items-center gap-1 rounded-lg px-2 text-sm ${active.link ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Ссылка
        </button>
        {active.link && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run("unlink")}
            className="h-8 rounded-lg px-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            Убрать ссылку
          </button>
        )}
      </div>
      {linkOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-2 py-2">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              // Enter вставляет ссылку, а не отправляет письмо
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setLinkOpen(false);
                restore();
              }
            }}
            placeholder="Адрес ссылки, например progrs.ru"
            aria-label="Адрес ссылки"
            className={`${inputClass} min-w-0 flex-1 py-1.5`}
          />
          <button type="button" onClick={applyLink} className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Вставить
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkOpen(false);
              restore();
            }}
            className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Отмена
          </button>
        </div>
      )}
      <div
        ref={box}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label="Текст письма"
        onInput={sync}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          sync();
        }}
        className="mail-editor min-h-60 resize-y overflow-auto px-3 py-2 text-sm leading-relaxed outline-none"
        style={{ height: "18rem" }}
      />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
