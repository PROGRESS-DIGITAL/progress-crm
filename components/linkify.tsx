import { Fragment } from "react";

// Адреса сайтов и почты в тексте становятся ссылками, которые открываются в новой вкладке.
// Только http(s), www. и почта: остальной текст выводится как есть, без HTML
const URL = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/gi;
// Точка или скобка в конце обычно относится к предложению, а не к адресу
const TAIL = /[.,!?;:»"')\]]+$/;

export function hrefOf(raw: string) {
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  return `mailto:${raw}`;
}

export function splitLinks(text: string) {
  const parts: { text: string; href?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL)) {
    const tail = m[0].match(TAIL)?.[0] ?? "";
    const link = m[0].slice(0, m[0].length - tail.length);
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: link, href: hrefOf(link) });
    last = m.index + link.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function Linkify({ text, className = "underline underline-offset-2" }: { text: string; className?: string }) {
  return (
    <>
      {splitLinks(text).map((p, i) =>
        p.href ? (
          // Почта открывается в почтовой программе, новая вкладка ей не нужна
          <a key={i} href={p.href} {...(p.href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })} className={className}>
            {p.text}
          </a>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}
