"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { REMIND_OPTIONS } from "@/lib/calendar";
import { useConfirm } from "@/components/confirm-dialog";
import { KindMark } from "@/components/event-kind";
import { deleteEvent, saveEvent, type EventInput } from "./actions";
import type { Options } from "./types";

const field =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const label = "block text-sm font-medium text-slate-700";

// Окно встречи или задачи: на телефоне выезжает снизу, на компьютере по центру
export function EventEditor({
  id,
  initial,
  options,
  remindersOn,
  onClose,
  onSaved,
}: {
  id: string | null;
  initial: EventInput;
  options: Options;
  remindersOn: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const confirm = useConfirm();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setD((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const company = options.companies.find((c) => c.name.toLowerCase() === d.clientName.trim().toLowerCase());
  const isNewClient = !!d.clientName.trim() && !company;
  // Сделки выбранного клиента; без клиента — все открытые
  const deals = options.deals.filter((x) =>
    company ? x.companyId === company.id : !d.clientName.trim() && (x.open || x.id === d.dealId),
  );
  const currentDeal = options.deals.find((x) => x.id === d.dealId);
  const tasks = options.tasks.filter((t) => t.id !== id && (!t.done || t.id === d.taskId));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveEvent(id, d);
      if (res.error) setError(res.error);
      else onSaved();
    });
  }

  async function remove() {
    if (!id) return;
    const what = d.kind === "TASK" ? "задачу" : "встречу";
    if (!(await confirm({ title: `Вы точно хотите удалить ${what} «${d.title || "без названия"}»?` }))) return;
    start(async () => {
      await deleteEvent(id);
      onSaved();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={id ? "Событие" : "Новое событие"}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex rounded-xl bg-slate-100 p-1 text-sm">
            {(["TASK", "MEETING"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set("kind", k)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium ${d.kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                <KindMark kind={k} />
                {k === "MEETING" ? "Встреча" : "Задача"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="text-2xl leading-none text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>

        <input
          autoFocus={!id}
          value={d.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={d.kind === "TASK" ? "Что сделать" : "Название встречи"}
          aria-label="Название"
          className="mt-4 w-full border-b border-slate-200 pb-2 text-xl font-medium outline-none placeholder:text-slate-300 focus:border-blue-500"
        />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className={`${label} col-span-2 sm:col-span-1`}>
            {d.allDay ? "С" : "Дата"}
            <input
              type="date"
              value={d.date}
              onChange={(e) => setD((p) => ({ ...p, date: e.target.value, endDate: p.endDate < e.target.value ? e.target.value : p.endDate }))}
              className={field}
              required
            />
          </label>
          {d.allDay ? (
            <label className={`${label} col-span-2`}>
              По
              <input type="date" value={d.endDate} min={d.date} onChange={(e) => set("endDate", e.target.value)} className={field} required />
            </label>
          ) : (
            <>
              <label className={label}>
                Начало
                <input type="time" step={300} value={d.startTime} onChange={(e) => set("startTime", e.target.value)} className={field} required />
              </label>
              <label className={label}>
                Конец
                <input type="time" step={300} value={d.endTime} onChange={(e) => set("endTime", e.target.value)} className={field} required />
              </label>
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={d.allDay} onChange={(e) => set("allDay", e.target.checked)} className="h-4 w-4 accent-blue-600" />
            Весь день
          </label>
          {d.kind === "TASK" && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={d.done} onChange={(e) => set("done", e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              Выполнена
            </label>
          )}
        </div>

        <label className={`${label} mt-4`}>
          Напомнить в Telegram
          <select value={d.remindMinutes} onChange={(e) => set("remindMinutes", e.target.value)} className={field}>
            <option value="">Не напоминать</option>
            {REMIND_OPTIONS.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {d.allDay ? (o.value >= 1440 ? "Накануне в 9:00" : "В 9:00 в этот день") : o.label}
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

        <label className={`${label} mt-4`}>
          Клиент
          <input
            list="calendar-clients"
            value={d.clientName}
            onChange={(e) => setD((p) => ({ ...p, clientName: e.target.value, dealId: p.dealId === "new" ? "new" : "" }))}
            placeholder="Начните вводить название"
            className={field}
          />
          <datalist id="calendar-clients">
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
              // Выбранная сделка подставляет своего клиента
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
            <input
              value={d.newDealTitle}
              onChange={(e) => set("newDealTitle", e.target.value)}
              placeholder={d.title || "Например, Сайт под ключ"}
              className={field}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">Сделка появится в первом этапе воронки</span>
          </label>
        )}

        <label className={`${label} mt-3`}>
          Связать с задачей
          <select value={d.taskId} onChange={(e) => set("taskId", e.target.value)} className={field}>
            <option value="">Без задачи</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.done ? " (выполнена)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className={`${label} mt-3`}>
          Заметки
          <textarea value={d.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={field} />
        </label>

        {id && (company || currentDeal || d.kind === "TASK") && (
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {d.kind === "TASK" && (
              <Link href={`/tasks/${id}`} className="text-blue-600 hover:underline">
                Карточка задачи и файлы
              </Link>
            )}
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

        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 flex items-center gap-3">
          {id && (
            <button type="button" onClick={remove} disabled={pending} className="text-sm text-rose-600 hover:text-rose-800">
              Удалить
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Отмена
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Сохраняю…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}
