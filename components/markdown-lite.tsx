import Link from "next/link";
import { Fragment } from "react";

// Небольшой разбор markdown для ответов AI-агента: абзацы, **жирный**, списки, таблицы и ссылки.
// Текст выводится как текст React, без HTML: ответ модели не может вставить разметку в страницу.
// Ссылки — только на страницы самой CRM (путь с «/»), внешние остаются текстом

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;
const ROW = /^\s*\|.*\|\s*$/;
const DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (ROW.test(line) && DIVIDER.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && ROW.test(lines[i])) rows.push(cells(lines[i++]));
      i--;
      blocks.push({ kind: "table", head, rows });
      continue;
    }
    const list = BULLET.test(line) ? "ul" : NUMBER.test(line) ? "ol" : null;
    if (list) {
      const re = list === "ul" ? BULLET : NUMBER;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""));
      i--;
      blocks.push({ kind: list, items });
      continue;
    }
    const prev = blocks.at(-1);
    if (prev?.kind === "p" && lines[i - 1]?.trim()) prev.lines.push(line.replace(/^#+\s*/, ""));
    else blocks.push({ kind: "p", lines: [line.replace(/^#+\s*/, "")] });
  }
  return blocks;
}

const LINK = /^\[([^\]]+)\]\((\/(?!\/)[^)\s]*)\)$/;

// **жирный**, `код` и [ссылка](/путь); остальное как есть
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(\/(?!\/)[^)\s]*\))/g);
  return (
    <>
      {parts.map((p, i) =>
        LINK.test(p) ? (
          <Link key={i} href={p.match(LINK)![2]} className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800">
            {p.match(LINK)![1]}
          </Link>
        ) : p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded bg-slate-100 px-1 text-[13px]">
            {p.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

const numeric = (s: string) => /^[−\-+]?[\d\s  ]+([.,]\d+)?\s*(₽|%|руб\.?)?$/.test(s.trim());

export function MarkdownLite({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 break-words">
      {parseMarkdown(text).map((b, i) => {
        if (b.kind === "p")
          return (
            <p key={i}>
              {b.lines.map((l, k) => (
                <Fragment key={k}>
                  {k > 0 && <br />}
                  <Inline text={l} />
                </Fragment>
              ))}
            </p>
          );
        if (b.kind === "ul" || b.kind === "ol") {
          const List = b.kind;
          return (
            <List key={i} className={`flex flex-col gap-1 pl-5 ${b.kind === "ul" ? "list-disc" : "list-decimal"}`}>
              {b.items.map((it, k) => (
                <li key={k}>
                  <Inline text={it} />
                </li>
              ))}
            </List>
          );
        }
        // Колонку с суммами выравниваем вправо целиком, вместе с заголовком
        const right = b.head.map((_, k) => b.rows.length > 0 && b.rows.every((r) => !r[k] || numeric(r[k])));
        return (
          <div key={i} className="-mx-1 overflow-x-auto px-1">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {b.head.map((h, k) => (
                    <th key={k} className={`py-1.5 pr-3 font-medium whitespace-nowrap ${right[k] ? "text-right" : ""}`}>
                      <Inline text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, k) => (
                  <tr key={k} className="border-b border-slate-100 last:border-0">
                    {r.map((c, j) => (
                      <td key={j} className={`py-1.5 pr-3 ${right[j] ? "text-right whitespace-nowrap tabular-nums" : ""}`}>
                        <Inline text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
