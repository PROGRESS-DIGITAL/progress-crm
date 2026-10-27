"use client";

import { useRef } from "react";

// HTML письма в изолированном окне: скрипты не выполняются, ссылки открываются в новой вкладке.
// Высота подстраивается под письмо, чтобы прокручивалась вся страница, а не окошко внутри
export function MailBody({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  function fit() {
    const doc = ref.current?.contentDocument;
    if (!doc || !ref.current) return;
    ref.current.style.height = `${doc.documentElement.scrollHeight}px`;
    // Картинки догружаются позже и меняют высоту
    new ResizeObserver(() => {
      if (ref.current) ref.current.style.height = `${doc.documentElement.scrollHeight}px`;
    }).observe(doc.body);
  }

  return (
    <iframe
      ref={ref}
      title="Текст письма"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={fit}
      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
        body{margin:0;padding:16px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:#fff;overflow-wrap:anywhere}
        img{max-width:100%;height:auto}table{max-width:100%}
      </style></head><body>${html}</body></html>`}
      className="block min-h-40 w-full rounded-xl border border-slate-200 bg-white"
    />
  );
}
