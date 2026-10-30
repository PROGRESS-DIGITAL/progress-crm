"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { TimeField } from "@/components/time-field";
import { REMIND_OPTIONS } from "@/lib/calendar";
import { MAX_FILE_SIZE, fileSize } from "@/lib/tasks";
import { deleteEvent, saveEvent, type EventInput } from "@/app/calendar/actions";
import { deleteTaskFile, uploadTaskFiles } from "./actions";

const field =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const label = "block text-sm font-medium text-slate-700";

export type TaskOptions = {
  companies: { id: string; name: string }[];
  deals: { id: string; title: string; companyId: string; open: boolean }[];
};
export type TaskFileRow = { id: string; name: string; size: number };

// Карточка задачи: текст, сроки, клиент и сделка, файлы. Сохраняется тем же действием, что и окно в календаре
export function TaskForm({
  id,
  initial,
  options,
  files,
  remindersOn,
}: {
  id: string | null;
  initial: EventInput;
  options: TaskOptions;
  files: TaskFileRow[];
  remindersOn: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [d, setD] = useState(initial);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setD((p) => ({ ...p, [k]: v }));

  const company = options.companies.find((c) => c.name.toLowerCase() === d.clientName.trim().toLowerCase());
  const isNewClient = !!d.clientName.trim() && !company;
  const deals = options.deals.filter((x) =>
    company ? x.companyId === company.id : !d.clientName.trim() && (x.open || x.id === d.dealId),
  );
  const currentDeal = options.deals.find((x) => x.id === d.dealId);

  async function upload(taskId: string, list: File[]) {
    if (list.length === 0) return null;
    const form = new FormData();
    list.forEach((f) => form.append("files", f));
    return (await uploadTaskFiles(taskId, form)).error ?? null;
  }

  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    const big = chosen.find((f) => f.size > MAX_FILE_SIZE);
    if (big) return setError(`Файл «${big.name}» больше ${fileSize(MAX_FILE_SIZE)}`);
    setError(null);
    // У сохранённой задачи файлы загружаются сразу, у новой — вместе с сохранением
    if (!id) return setPendingFiles((p) => [...p, ...chosen]);
    start(async () => {
      const err = await upload(id, chosen);
      if (err) setError(err);
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveEvent(id, d);
      if (res.error || !res.id) return setError(res.error ?? "Не удалось сохранить");
      const err = await upload(res.id, pendingFiles);
      if (err) {
        setError(`Задача сохранена, но файлы не загрузились: ${err}`);
        return router.replace(`/tasks/${res.id}`);
      }
      router.push("/tasks");
    });
  }

  async function remove() {
    if (!id) return;
    const ok = await confirm({ title: `Вы точно хотите удалить задачу «${d.title || "без названия"}»?`, text: "Вместе с ней удалятся прикреплённые файлы." });
    if (!ok) return;
    start(async () => {
      await deleteEvent(id);
      router.push("/tasks");
    });
  }

  async function removeFile(fileId: string) {
    const name = files.find((f) => f.id === fileId)?.name ?? "файл";
    if (!(await confirm({ title: `Вы точно хотите удалить файл «${name}»?` }))) return;
    start(async () => {
      await deleteTaskFile(fileId);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
          <input
            autoFocus={!id}
            value={d.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Что сделать"
            aria-label="Название задачи"
            className="w-full border-b border-slate-200 pb-2 text-xl font-semibold outline-none placeholder:text-slate-300 focus:border-blue-500"
          />
          <label className={`${label} mt-5`}>
            Описание
            <textarea
              value={d.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={10}
              placeholder="Подробности, ссылки, договорённости"
              className={`${field} min-h-48 resize-y leading-relaxed`}
            />
          </label>
        </section>

        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
          {files.length + pendingFiles.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Файлов нет. До {fileSize(MAX_FILE_SIZE)} каждый.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Icon name="document" size={18} className="text-slate-400" />
                  <a href={`/tasks/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-blue-700 hover:underline">
                    {f.name}
                  </a>
                  <span className="shrink-0 text-xs text-slate-500 tabular-nums">{fileSize(f.size)}</span>
                  <button type="button" onClick={() => removeFile(f.id)} aria-label={`Удалить ${f.name}`} className="text-slate-400 hover:text-rose-600">
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
              {pendingFiles.map((f, i) => (
                <li key={`p${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <Icon name="document" size={18} className="text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">загрузится при сохранении</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
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
      </div>

      <aside className="flex flex-col gap-4">
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={d.done} onChange={(e) => set("done", e.target.checked)} className="h-4 w-4 accent-emerald-600" />
            Выполнена
          </label>

          {/* Поля друг под другом: колонка справа узкая, рядом время не помещается */}
          <div className="mt-4 grid gap-3">
            <label className={label}>
              {d.allDay ? "Начало" : "Дата"}
              <input
                type="date"
                value={d.date}
                onChange={(e) => setD((p) => ({ ...p, date: e.target.value, endDate: p.endDate < e.target.value ? e.target.value : p.endDate }))}
                className={field}
                required
              />
            </label>
            {d.allDay ? (
              <label className={label}>
                Конец
                <input type="date" value={d.endDate} min={d.date} onChange={(e) => set("endDate", e.target.value)} className={field} required />
              </label>
            ) : (
              <>
                <label className={label}>
                  С
                  <TimeField label="Начало" value={d.startTime} onChange={(v) => set("startTime", v)} />
                </label>
                <label className={label}>
                  До
                  <TimeField label="Конец" value={d.endTime} onChange={(v) => set("endTime", v)} />
                </label>
              </>
            )}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!d.allDay} onChange={(e) => set("allDay", !e.target.checked)} className="h-4 w-4 accent-blue-600" />
            Указать время
          </label>

          <label className={`${label} mt-4`}>
            Напомнить в Telegram
            <select value={d.remindMinutes} onChange={(e) => set("remindMinutes", e.target.value)} className={field}>
              <option value="">Не напоминать</option>
              {REMIND_OPTIONS.map((o) => (
                <option key={o.value} value={String(o.value)}>
                  {d.allDay ? (o.value >= 1440 ? "Накануне в 9:00" : "В 9:00 в день начала") : o.label}
                </option>
              ))}
            </select>
            {!remindersOn && d.remindMinutes !== "" && (
              <span className="mt-1 block text-xs font-normal text-amber-700">
                Напоминания пока не приходят:{" "}
                <Link href="/integrations/telegram#reminders" className="text-blue-600 hover:underline">
                  подключите их в Telegram
                </Link>
              </span>
            )}
          </label>
        </section>

        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
          <label className={label}>
            Клиент
            <input
              list="task-clients"
              value={d.clientName}
              onChange={(e) => setD((p) => ({ ...p, clientName: e.target.value, dealId: p.dealId === "new" ? "new" : "" }))}
              placeholder="Начните вводить название"
              className={field}
            />
            <datalist id="task-clients">
              {options.companies.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            {isNewClient && <span className="mt-1 block text-xs font-normal text-blue-600">Такого клиента нет, создам нового при сохранении</span>}
          </label>
          <label className={`${label} mt-3`}>
            Сделка
            <select
              value={d.dealId}
              onChange={(e) => {
                const deal = options.deals.find((x) => x.id === e.target.value);
                const owner = deal && options.companies.find((c) => c.id === deal.companyId);
                setD((p) => ({ ...p, dealId: e.target.value, clientName: owner ? owner.name : p.clientName }));
              }}
              className={field}
            >
              <option value="">Без сделки</option>
              {currentDeal && !deals.includes(currentDeal) && <option value={currentDeal.id}>{currentDeal.title}</option>}
              {deals.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                  {x.open ? "" : " (закрыта)"}
                </option>
              ))}
              <option value="new">+ Новая сделка</option>
            </select>
          </label>
          {d.dealId === "new" && (
            <label className={`${label} mt-3`}>
              Название новой сделки
              <input value={d.newDealTitle} onChange={(e) => set("newDealTitle", e.target.value)} placeholder={d.title || "Например, Сайт под ключ"} className={field} />
            </label>
          )}
          {(company || (currentDeal && d.dealId !== "new")) && (
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {company && (
                <Link href={`/clients/${company.id}`} className="text-blue-600 hover:underline">
                  Карточка клиента
                </Link>
              )}
              {currentDeal && (
                <Link href={`/deals/${currentDeal.id}`} className="text-blue-600 hover:underline">
                  Открыть сделку
                </Link>
              )}
            </p>
          )}
        </section>

        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="flex items-center gap-3">
          {id && (
            <button type="button" onClick={remove} disabled={busy} className="text-sm text-rose-600 hover:text-rose-800">
              Удалить
            </button>
          )}
          <Link href="/tasks" className="ml-auto rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Отмена
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
