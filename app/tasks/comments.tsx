"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { splitLinks } from "@/components/linkify";
import { mentionQuery, splitMentions, suggestPeople, type MentionPerson } from "@/lib/mentions";
import { addTaskComment, deleteTaskComment } from "./actions";

export type CommentRow = { id: string; authorId: string | null; authorName: string; avatar: string | null; text: string; createdAt: string };

const when = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

// Комментарии команды под описанием задачи. Пишутся сразу, без кнопки «Сохранить» у задачи
export function TaskComments({
  taskId,
  comments,
  me,
  people,
}: {
  taskId: string | null;
  comments: CommentRow[];
  me: { id: string; isOwner: boolean };
  // Кого можно упомянуть через @: все сотрудники с логином, включая себя
  people: MentionPerson[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  // Подсказка логинов: что набрано после @ и какая строка выделена
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const suggestions = query === null ? [] : suggestPeople(people, query, 8);
  const open = suggestions.length > 0;
  const logins = people.map((p) => p.login);
  const byLogin = new Map(people.map((p) => [p.login.toLowerCase(), p]));

  function track(value: string, caret: number) {
    const q = mentionQuery(value.slice(0, caret));
    setQuery(q);
    if (q !== query) setActive(0);
  }

  // Заменяем набранное «@сел» на «@selin » и ставим курсор после пробела
  function pick(p: MentionPerson) {
    const el = area.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const insert = `@${p.login} `;
    const next = text.slice(0, at) + insert + text.slice(caret).replace(/^\s+/, "");
    setText(next);
    setQuery(null);
    const pos = at + insert.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function send() {
    if (!taskId || !text.trim()) return;
    setError(null);
    start(async () => {
      const r = await addTaskComment(taskId, text);
      if (r.error) return setError(r.error);
      setText("");
      router.refresh();
    });
  }

  async function remove(c: CommentRow) {
    if (!(await confirm({ title: "Вы точно хотите удалить комментарий?", text: c.text.length > 80 ? `${c.text.slice(0, 80)}…` : c.text }))) return;
    start(async () => {
      const r = await deleteTaskComment(c.id);
      if (r.error) setError(r.error);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6" aria-label="Комментарии">
      <h2 className="font-semibold">
        Комментарии{comments.length > 0 && <span className="ml-2 text-sm font-normal text-slate-500">{comments.length}</span>}
      </h2>
      {comments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.authorName} src={c.avatar} size={32} />
              <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{c.authorName}</span>
                  <time dateTime={c.createdAt} className="text-xs text-slate-500">
                    {when.format(new Date(c.createdAt)).replace(" в ", ", ")}
                  </time>
                  {(me.isOwner || c.authorId === me.id) && (
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      disabled={busy}
                      aria-label="Удалить комментарий"
                      className="ml-auto text-slate-400 hover:text-rose-600"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700">
                  <CommentText text={c.text} logins={logins} byLogin={byLogin} meId={me.id} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {taskId ? (
        <div className="relative mt-3">
          <textarea
            ref={area}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              track(e.target.value, e.target.selectionStart);
            }}
            onSelect={(e) => track(e.currentTarget.value, e.currentTarget.selectionStart)}
            onBlur={() => setQuery(null)}
            onKeyDown={(e) => {
              // Открыт список логинов: стрелки выбирают, Enter или Tab вставляют, Esc закрывает
              if (open) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const step = e.key === "ArrowDown" ? 1 : -1;
                  setActive((a) => (a + step + suggestions.length) % suggestions.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  pick(suggestions[Math.min(active, suggestions.length - 1)]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setQuery(null);
                  return;
                }
              }
              // Enter отправляет, Shift+Enter — новая строка. Форму задачи при этом не сохраняем
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={5000}
            placeholder="Написать комментарий команде, @ — упомянуть коллегу"
            aria-label="Новый комментарий"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="mention-list"
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {open && (
            <ul
              id="mention-list"
              role="listbox"
              aria-label="Кого упомянуть"
              className="absolute top-full left-0 z-30 -mt-1 max-h-72 w-72 max-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
            >
              {suggestions.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    // mousedown, а не click: иначе textarea теряет фокус и список закрывается раньше
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(p);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${i === active ? "bg-blue-50" : ""}`}
                  >
                    <Avatar name={p.name} src={p.avatar} size={24} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{p.name}</span>
                      {p.id === me.id && <span className="ml-1 text-slate-500">(вы)</span>}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">@{p.login}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-rose-600">{error}</span>
            <button
              type="button"
              onClick={send}
              disabled={busy || !text.trim()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? "Отправляю…" : "Отправить"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Комментарии можно оставить после того, как задача сохранится.</p>
      )}
    </section>
  );
}

// Текст комментария: ссылки открываются в новой вкладке, @логины коллег выделены, своё упоминание — ярче
function CommentText({
  text,
  logins,
  byLogin,
  meId,
}: {
  text: string;
  logins: string[];
  byLogin: Map<string, MentionPerson>;
  meId: string;
}) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.href ? (
          <a
            key={i}
            href={part.href}
            {...(part.href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
          >
            {part.text}
          </a>
        ) : (
          <Fragment key={i}>
            {splitMentions(part.text, logins).map((m, j) => {
              if (!m.login) return <Fragment key={j}>{m.text}</Fragment>;
              const who = byLogin.get(m.login);
              const mine = who?.id === meId;
              return (
                <span
                  key={j}
                  title={who?.name}
                  className={`rounded px-0.5 font-medium ${mine ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"}`}
                >
                  {m.text}
                </span>
              );
            })}
          </Fragment>
        ),
      )}
    </>
  );
}
