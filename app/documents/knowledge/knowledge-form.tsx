"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KnowledgeKind } from "@prisma/client";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { RichEditor } from "@/components/rich-editor";
import { KNOWLEDGE_KINDS } from "@/lib/knowledge";
import { MAX_FILE_SIZE, fileSize } from "@/lib/tasks";
import { deleteKnowledge, deleteKnowledgeFile, saveKnowledge } from "./actions";

type FileRow = { id: string; name: string; size: number };

const field =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

// Материал базы знаний: название, раздел, текст как в Word и файлы. Новые файлы загружаются вместе с сохранением
export function KnowledgeForm({
  id,
  initial,
  files,
  author,
}: {
  id: string | null;
  initial: { title: string; kind: KnowledgeKind; content: string };
  files: FileRow[];
  author?: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    const big = chosen.find((f) => f.size > MAX_FILE_SIZE);
    if (big) return setError(`Файл «${big.name}» больше ${fileSize(MAX_FILE_SIZE)}`);
    setError(null);
    setSaved(false);
    setPending((p) => [...p, ...chosen]);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    pending.forEach((f) => form.append("files", f));
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await saveKnowledge(id, form);
      if (r.error || !r.id) return setError(r.error ?? "Не удалось сохранить");
      setPending([]);
      setSaved(true);
      if (!id) router.replace(`/documents/knowledge/${r.id}`);
      else router.refresh();
    });
  }

  async function removeFile(f: FileRow) {
    if (!(await confirm({ title: `Вы точно хотите удалить файл «${f.name}»?` }))) return;
    start(async () => {
      await deleteKnowledgeFile(f.id);
      router.refresh();
    });
  }

  async function remove() {
    if (!id) return;
    const ok = await confirm({
      title: `Вы точно хотите удалить материал «${initial.title}»?`,
      text: "Он попадёт в корзину вместе с файлами: оттуда его можно восстановить в течение 30 дней.",
    });
    if (!ok) return;
    start(async () => {
      await deleteKnowledge(id);
      router.push("/documents?tab=knowledge");
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
          <input
            name="title"
            required
            maxLength={200}
            autoFocus={!id}
            defaultValue={initial.title}
            placeholder="Название: например, Бриф на разработку сайта"
            aria-label="Название материала"
            className="w-full border-b border-slate-200 pb-2 text-xl font-semibold outline-none placeholder:text-slate-300 focus:border-blue-500"
          />
        </section>
        <section className="min-w-0 rounded-2xl border border-slate-200/60 bg-white p-3 shadow-card sm:p-4" aria-label="Текст материала">
          <RichEditor name="content" initialHtml={initial.content} />
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
          <label className="block text-sm font-medium text-slate-700">
            Раздел
            <select name="kind" defaultValue={initial.kind} className={field}>
              {KNOWLEDGE_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.one}
                </option>
              ))}
            </select>
          </label>
          {author && <p className="mt-3 text-xs text-slate-500">Добавил: {author}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Файлы</h2>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              <Icon name="clip" size={16} />
              Прикрепить
            </button>
            <input ref={input} type="file" multiple hidden onChange={(e) => pick(e.target.files)} />
          </div>
          {files.length + pending.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Word, PDF, таблицы, презентации, картинки. До {fileSize(MAX_FILE_SIZE)} каждый.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 py-2.5 text-sm">
                  <Icon name="document" size={18} className="text-slate-400" />
                  <a href={`/documents/knowledge/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-blue-700 hover:underline">
                    {f.name}
                  </a>
                  <span className="shrink-0 text-xs text-slate-500 tabular-nums">{fileSize(f.size)}</span>
                  <button type="button" onClick={() => removeFile(f)} aria-label={`Удалить ${f.name}`} className="text-slate-400 hover:text-rose-600">
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
              {pending.map((f, i) => (
                <li key={`p${i}`} className="flex items-center gap-2 py-2.5 text-sm">
                  <Icon name="document" size={18} className="text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">при сохранении</span>
                  <button
                    type="button"
                    onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                    aria-label={`Убрать ${f.name}`}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {saved && !busy && !error && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Сохранено</p>}

        <div className="flex items-center gap-3">
          {id && (
            <button type="button" onClick={remove} disabled={busy} className="text-sm text-rose-600 hover:text-rose-800">
              Удалить
            </button>
          )}
          <Link href="/documents?tab=knowledge" className="ml-auto rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            К списку
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Сохраняю…" : "Сохранить"}
          </button>
        </div>
      </aside>
    </form>
  );
}
