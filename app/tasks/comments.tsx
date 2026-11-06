"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { addTaskComment, deleteTaskComment } from "./actions";

export type CommentRow = { id: string; authorId: string | null; authorName: string; avatar: string | null; text: string; createdAt: string };

const when = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

// Комментарии команды под описанием задачи. Пишутся сразу, без кнопки «Сохранить» у задачи
export function TaskComments({ taskId, comments, me }: { taskId: string | null; comments: CommentRow[]; me: { id: string; isOwner: boolean } }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

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
                <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {taskId ? (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter отправляет, Shift+Enter — новая строка. Форму задачи при этом не сохраняем
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={5000}
            placeholder="Написать комментарий команде"
            aria-label="Новый комментарий"
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
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
