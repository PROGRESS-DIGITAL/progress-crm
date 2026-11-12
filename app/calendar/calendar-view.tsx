"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import {
  VIEWS,
  coversDay,
  dayKey,
  layoutDay,
  layoutSpans,
  minutesOfDay,
  resizeRange,
  shift,
  timeLabel,
  viewTitle,
  MIN_EVENT_MINUTES,
  type CalendarView as View,
} from "@/lib/calendar";
import { moveEvent, resizeEvent, toggleDone } from "./actions";
import { draftFromEvent, emptyDraft } from "./drafts";
import { KindMark, Tick } from "@/components/event-kind";
import { EventEditor } from "./event-editor";
import type { EventInput } from "./actions";
import type { CalEvent, Options, Prefill } from "./types";
import type { SourceRef } from "@/lib/source-link";

const HOUR = 48; // высота часа в сетке, px
const SNAP = 15; // шаг перетаскивания, минуты
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// «26 окт – 31 окт» для многодневных событий: конец хранится как начало следующего дня
const shortDay = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" }).replace(".", "");
const rangeLabel = (e: CalEvent) => `${shortDay(new Date(e.start))} – ${shortDay(new Date(Date.parse(e.end) - 1))}`;

const href = (view: View, date: string) => `/calendar?view=${view}&date=${date}`;
const weekday = (key: string) => WEEKDAYS[(new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7];

// Встреча — голубая плашка с полоской слева и иконкой людей, задача — жёлтая карточка с рамкой и кружком-чекбоксом.
// Отмеченные «Выполнена» и «Состоялась» серые
function tone(e: CalEvent) {
  if (e.kind === "MEETING") return e.done ? "border-l-4 border-slate-300 bg-slate-100 text-slate-500" : "border-l-4 border-blue-500 bg-blue-50 text-blue-950";
  if (e.done) return "border border-l-4 border-slate-200 border-l-slate-300 bg-slate-100 text-slate-500";
  return "border border-l-4 border-amber-300 border-l-amber-500 bg-amber-50 text-amber-950";
}

// Просрочено: время прошло, а задача не выполнена или встреча не отмечена как состоявшаяся.
// Красная обводка, как у просроченных сделок
function overdueRing(e: CalEvent, now: number | null) {
  return now !== null && !e.done && Date.parse(e.end) < now ? "ring-2 ring-rose-500" : "";
}
const struck = (e: CalEvent) => (e.kind === "TASK" && e.done ? "line-through" : "");

// Текущее время, обновляется раз в минуту; на сервере null, чтобы разметка совпала при гидрации
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

type Editing = { id: string | null; draft: EventInput; source?: SourceRef | null };
// move — перенос карточки целиком, top и bottom — растягивание за верхний или нижний край
type Drag = { id: string; mode: "move" | "top" | "bottom"; x: number; y: number; width: number; dx: number; dy: number; moved: boolean };

export function CalendarView({
  view,
  date,
  today,
  days,
  events: serverEvents,
  companies,
  deals,
  tasks,
  prefill,
  prefillSource,
  openEvent,
  explicitView,
  remindersOn,
}: Options & {
  view: View;
  date: string;
  today: string;
  days: string[];
  events: CalEvent[];
  prefill: Prefill | null;
  prefillSource: SourceRef | null;
  openEvent: CalEvent | null;
  explicitView: boolean;
  remindersOn: boolean;
}) {
  const router = useRouter();
  const [events, setEvents] = useState(serverEvents);
  useEffect(() => setEvents(serverEvents), [serverEvents]);
  const [editing, setEditing] = useState<Editing | null>(() => {
    if (openEvent) return { id: openEvent.id, draft: draftFromEvent(openEvent), source: openEvent.source };
    if (prefill) return { id: null, draft: emptyDraft(date, 10 * 60, prefill), source: prefillSource };
    return null;
  });

  // На телефоне неделя тесная: если вид не выбран явно, открываем день
  useEffect(() => {
    if (!explicitView && view === "week" && window.innerWidth < 640) router.replace(href("day", date));
  }, [explicitView, view, date, router]);

  function closeEditor(saved: boolean) {
    setEditing(null);
    if (prefill || openEvent) router.replace(href(view, date));
    if (saved) router.refresh();
  }

  function create(day: string, minutes = 9 * 60, allDay = false) {
    setEditing({ id: null, draft: emptyDraft(day, minutes, { allDay }) });
  }

  const options: Options = { companies, deals, tasks };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight">{viewTitle(view, date)}</h1>
        <div className="hidden items-center gap-3 text-xs text-slate-500 sm:flex">
          <span className="flex items-center gap-1.5">
            <KindMark kind="TASK" />
            Задачи
          </span>
          <span className="flex items-center gap-1.5">
            <KindMark kind="MEETING" />
            Встречи
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={href(view, today)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Сегодня
          </Link>
          <Link href={href(view, shift(view, date, -1))} aria-label="Назад" className="rounded-xl p-2 text-slate-600 hover:bg-white">
            <Icon name="back" />
          </Link>
          <Link href={href(view, shift(view, date, 1))} aria-label="Вперёд" className="rounded-xl p-2 text-slate-600 hover:bg-white">
            <Icon name="back" className="rotate-180" />
          </Link>
        </div>
        <div className="flex rounded-xl bg-white p-1 text-sm shadow-card">
          {VIEWS.map((v) => (
            <Link
              key={v.id}
              href={href(v.id, date)}
              aria-current={v.id === view ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 font-medium ${v.id === view ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => (days.includes(today) && view !== "day") || date === today ? create(today, nextSlot()) : create(view === "day" ? date : days[0], 10 * 60)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
        >
          <Icon name="plus" size={18} />
          Создать
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-card">
        {view === "month" ? (
          <MonthGrid
            date={date}
            today={today}
            days={days}
            events={events}
            onCreate={(d) => create(d)}
            onOpen={(e) => setEditing({ id: e.id, draft: draftFromEvent(e), source: e.source })}
          />
        ) : (
          <TimeGrid
            view={view}
            today={today}
            days={days}
            events={events}
            onCreate={create}
            onOpen={(e) => setEditing({ id: e.id, draft: draftFromEvent(e), source: e.source })}
            onMove={(id, start) => {
              setEvents((list) =>
                list.map((e) => {
                  if (e.id !== id) return e;
                  const length = Date.parse(e.end) - Date.parse(e.start);
                  return { ...e, start: start.toISOString(), end: new Date(start.getTime() + length).toISOString() };
                }),
              );
              moveEvent(id, start.toISOString()).then(() => router.refresh());
            }}
            onResize={(id, start, end) => {
              setEvents((list) => list.map((e) => (e.id === id ? { ...e, start: start.toISOString(), end: end.toISOString() } : e)));
              resizeEvent(id, start.toISOString(), end.toISOString()).then(() => router.refresh());
            }}
            onToggle={(id) => {
              setEvents((list) => list.map((e) => (e.id === id ? { ...e, done: !e.done } : e)));
              toggleDone(id).then(() => router.refresh());
            }}
          />
        )}
      </div>

      {editing && (
        <EventEditor
          id={editing.id}
          initial={editing.draft}
          source={editing.source}
          options={options}
          remindersOn={remindersOn}
          onClose={() => closeEditor(false)}
          onSaved={() => closeEditor(true)}
        />
      )}
    </>
  );
}

// Ближайшие полчаса от текущего времени
function nextSlot() {
  const m = minutesOfDay(new Date());
  return Math.min(Math.ceil((m + 1) / 30) * 30, 23 * 60);
}

function TimeGrid({
  view,
  today,
  days,
  events,
  onCreate,
  onOpen,
  onMove,
  onResize,
  onToggle,
}: {
  view: View;
  today: string;
  days: string[];
  events: CalEvent[];
  onCreate: (day: string, minutes?: number, allDay?: boolean) => void;
  onOpen: (e: CalEvent) => void;
  onMove: (id: string, start: Date) => void;
  onResize: (id: string, start: Date, end: Date) => void;
  onToggle: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const nowMs = useNow();
  const now = nowMs === null ? null : minutesOfDay(new Date(nowMs));
  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);
  const spans = layoutSpans(
    allDay.map((e) => ({ id: e.id, start: new Date(e.start), end: new Date(e.end) })),
    days,
  );
  const template = { gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` };

  // Сетка открывается на рабочем утре или на первом раннем событии
  useLayoutEffect(() => {
    const first = Math.min(8 * 60, ...timed.map((e) => minutesOfDay(new Date(e.start))));
    if (scroller.current) scroller.current.scrollTop = (first / 60) * HOUR - 8;
    // Прокрутку задаём один раз при открытии вида
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onColumnClick(e: React.MouseEvent<HTMLDivElement>, day: string) {
    if (e.target !== e.currentTarget) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    onCreate(day, Math.min(Math.floor(((y / HOUR) * 60) / 30) * 30, 23 * 60));
  }

  function startDrag(e: React.PointerEvent<HTMLElement>, id: string, mode: Drag["mode"] = "move") {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const card = e.currentTarget.closest<HTMLElement>("[data-event]")!;
    const width = card.parentElement!.getBoundingClientRect().width;
    setDrag({ id, mode, x: e.clientX, y: e.clientY, width, dx: 0, dy: 0, moved: false });
  }

  function deltas(d: Drag, dayIndex: number) {
    const minutes = Math.round(((d.dy / HOUR) * 60) / SNAP) * SNAP;
    const daysShift = Math.max(-dayIndex, Math.min(days.length - 1 - dayIndex, Math.round(d.dx / d.width)));
    return { minutes, daysShift };
  }

  function endDrag(e: CalEvent, dayIndex: number) {
    if (!drag || drag.id !== e.id) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return d.mode === "move" ? onOpen(e) : undefined;
    const { minutes, daysShift } = deltas(d, dayIndex);
    if (d.mode !== "move") {
      if (!minutes) return;
      const r = resizeRange(new Date(e.start), new Date(e.end), d.mode, minutes);
      return onResize(e.id, r.start, r.end);
    }
    if (!minutes && !daysShift) return;
    onMove(e.id, new Date(Date.parse(e.start) + (daysShift * 1440 + minutes) * 60_000));
  }

  return (
    <div className="relative overflow-x-auto">
      <div style={{ minWidth: days.length > 1 ? 720 : undefined }}>
        <div className="grid border-b border-slate-200" style={template}>
          <div />
          {days.map((day) => (
            <Link
              key={day}
              href={href("day", day)}
              className="flex flex-col items-center gap-0.5 border-l border-slate-100 py-2 text-xs text-slate-500 hover:bg-slate-50"
            >
              {weekday(day)}
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${
                  day === today ? "bg-blue-600 font-semibold text-white" : "text-slate-800"
                }`}
              >
                {Number(day.slice(8))}
              </span>
            </Link>
          ))}
        </div>

        <div className="grid border-b border-slate-200" style={template}>
          <div className="px-1 py-2 text-right text-[10px] leading-tight text-slate-400">весь день</div>
          {/* Многодневное событие — одна карточка через все свои дни, пересекающиеся идут строками */}
          <div
            className="grid gap-y-1 py-1"
            style={{
              gridColumn: `2 / span ${days.length}`,
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${Math.max(1, ...spans.map((s) => s.lane + 1))}, 40px)`,
            }}
          >
            {days.map((day, i) => (
              <div
                key={day}
                onClick={() => onCreate(day, 0, true)}
                className="-my-1 cursor-pointer border-l border-slate-100"
                style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
              />
            ))}
            {spans.map((s) => {
              const e = allDay.find((x) => x.id === s.id)!;
              const multi = Date.parse(e.end) - Date.parse(e.start) > 86_400_000;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpen(e)}
                  style={{ gridColumn: `${s.first + 1} / ${s.last + 2}`, gridRow: s.lane + 1 }}
                  className={`relative z-10 mx-1 flex min-w-0 items-center gap-1.5 rounded-lg px-2 text-left text-sm font-medium ${tone(e)} ${overdueRing(e, nowMs)} ${
                    s.cutStart ? "-ml-px rounded-l-none" : ""
                  } ${s.cutEnd ? "-mr-px rounded-r-none" : ""}`}
                >
                  {e.kind === "MEETING" ? <Icon name="users" size={14} className="shrink-0" /> : <KindMark kind="TASK" done={e.done} />}
                  <span className="min-w-0">
                    <span className={`block truncate ${struck(e)}`}>{e.title}</span>
                    {multi && <span className="block truncate text-[11px] font-normal opacity-70">{rangeLabel(e)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={scroller} className="h-[calc(100dvh-300px)] min-h-[420px] overflow-y-auto overscroll-contain">
          <div className="relative grid" style={{ ...template, height: 24 * HOUR }}>
            <div className="relative">
              {Array.from({ length: 23 }, (_, i) => (
                <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] text-slate-400" style={{ top: (i + 1) * HOUR }}>
                  {timeLabel((i + 1) * 60)}
                </span>
              ))}
            </div>
            {days.map((day, dayIndex) => {
              const mine = timed.filter((e) => coversDay({ start: new Date(e.start), end: new Date(e.end) }, day));
              const placed = layoutDay(
                mine.map((e) => ({ id: e.id, start: new Date(e.start), end: new Date(e.end) })),
                day,
                20,
              );
              return (
                <div
                  key={day}
                  data-day={day}
                  onClick={(e) => onColumnClick(e, day)}
                  className="relative cursor-pointer border-l border-slate-100"
                  style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR - 1}px, var(--color-slate-100) ${HOUR - 1}px ${HOUR}px)` }}
                >
                  {placed.map((p) => {
                    const e = mine.find((x) => x.id === p.id)!;
                    const dragging = drag?.id === e.id && drag.moved;
                    const moving = dragging && drag.mode === "move";
                    const shiftBy = moving ? deltas(drag, dayIndex) : null;
                    // Пока тянут край, карточка и подпись времени показывают новое время
                    const resized =
                      dragging && drag.mode !== "move"
                        ? resizeRange(new Date(e.start), new Date(e.end), drag.mode, deltas(drag, dayIndex).minutes)
                        : null;
                    const start = resized?.start ?? new Date(e.start);
                    const end = resized?.end ?? new Date(e.end);
                    const topShift = resized ? (start.getTime() - Date.parse(e.start)) / 60_000 : 0;
                    const lengthShift = resized ? (end.getTime() - start.getTime() - (Date.parse(e.end) - Date.parse(e.start))) / 60_000 : 0;
                    // Ручки только у тех краёв, что лежат в этом дне: у многодневной встречи верх в первом дне, низ в последнем
                    const canTop = dayKey(new Date(e.start)) === day;
                    const canBottom = dayKey(new Date(Date.parse(e.end) - 1)) === day;
                    const short = p.height < 40;
                    return (
                      <div
                        key={e.id}
                        data-event
                        role="button"
                        tabIndex={0}
                        onPointerDown={(ev) => startDrag(ev, e.id)}
                        onPointerMove={(ev) => {
                          if (!drag || drag.id !== e.id) return;
                          const dx = ev.clientX - drag.x;
                          const dy = ev.clientY - drag.y;
                          setDrag({ ...drag, dx, dy, moved: drag.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4 });
                        }}
                        onPointerUp={() => endDrag(e, dayIndex)}
                        onPointerCancel={() => setDrag(null)}
                        onKeyDown={(ev) => ev.key === "Enter" && onOpen(e)}
                        onClick={(ev) => ev.stopPropagation()}
                        className={`group absolute touch-none overflow-hidden rounded-lg px-1.5 text-xs select-none ${tone(e)} ${overdueRing(e, nowMs)} ${
                          dragging ? `z-20 opacity-90 shadow-lg ${moving ? "cursor-grabbing" : "cursor-ns-resize"}` : "z-10 cursor-grab hover:shadow-md"
                        } ${short ? "py-0" : "py-1"}`}
                        style={{
                          top: ((p.top + topShift) / 60) * HOUR + 1,
                          height: (Math.max(p.height + lengthShift, MIN_EVENT_MINUTES) / 60) * HOUR - 2,
                          left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                          width: `calc(${100 / p.cols}% - 4px)`,
                          transform: shiftBy
                            ? `translate(${shiftBy.daysShift * drag!.width}px, ${(shiftBy.minutes / 60) * HOUR}px)`
                            : undefined,
                        }}
                      >
                        {canTop && (
                          <span
                            aria-hidden
                            title="Потяните, чтобы изменить начало"
                            onPointerDown={(ev) => startDrag(ev, e.id, "top")}
                            className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize"
                          />
                        )}
                        {canBottom && (
                          <span
                            aria-hidden
                            title="Потяните, чтобы изменить окончание"
                            onPointerDown={(ev) => startDrag(ev, e.id, "bottom")}
                            className="absolute inset-x-0 bottom-0 z-10 flex h-2 cursor-ns-resize items-end justify-center pb-0.5"
                          >
                            <span className="h-0.5 w-6 rounded-full bg-current opacity-0 group-hover:opacity-30" />
                          </span>
                        )}
                        <div className={`flex items-start gap-1 ${short ? "leading-4" : ""}`}>
                          {e.kind === "MEETING" && <Icon name="users" size={12} className="mt-0.5 shrink-0" />}
                          {e.kind === "TASK" && (
                            <button
                              type="button"
                              aria-label={e.done ? "Вернуть в работу" : "Отметить выполненной"}
                              onPointerDown={(ev) => ev.stopPropagation()}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onToggle(e.id);
                              }}
                              className={`mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                                e.done ? "border-slate-400 bg-slate-400 text-white" : "border-amber-500 bg-white hover:bg-amber-100"
                              }`}
                            >
                              {e.done && <Tick size={10} />}
                            </button>
                          )}
                          <span className={`min-w-0 truncate font-medium ${struck(e)}`}>{e.title}</span>
                          {short && <span className="shrink-0 opacity-70">{timeLabel(minutesOfDay(start))}</span>}
                        </div>
                        {!short && (
                          <div className="truncate opacity-75">
                            {timeLabel(minutesOfDay(start))}–{timeLabel(minutesOfDay(end))}
                            {e.companyName && ` · ${e.companyName}`}
                          </div>
                        )}
                        {!short && p.height >= 75 && e.dealTitle && <div className="truncate opacity-75">{e.dealTitle}</div>}
                      </div>
                    );
                  })}
                  {day === today && now !== null && (
                    <div className="pointer-events-none absolute inset-x-0 z-30 h-0.5 bg-rose-500" style={{ top: (now / 60) * HOUR }}>
                      <span className="absolute -top-[5px] -left-[5px] h-3 w-3 rounded-full bg-rose-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {view === "day" && timed.length + allDay.length === 0 && (
        <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">На этот день ничего нет. Нажмите на время, чтобы добавить задачу или встречу.</p>
      )}
    </div>
  );
}

function MonthGrid({
  date,
  today,
  days,
  events,
  onCreate,
  onOpen,
}: {
  date: string;
  today: string;
  days: string[];
  events: CalEvent[];
  onCreate: (day: string) => void;
  onOpen: (e: CalEvent) => void;
}) {
  const month = date.slice(0, 7);
  const now = useNow();
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs text-slate-500">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      {Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7)).map((week, w) => {
        const allDay = events.filter((e) => e.allDay);
        const spans = layoutSpans(
          allDay.map((e) => ({ id: e.id, start: new Date(e.start), end: new Date(e.end) })),
          week,
        );
        const lanes = Math.max(0, ...spans.map((s) => s.lane + 1));
        return (
          // Неделя — сетка: номер дня, полосы событий «весь день» через все их дни, ниже события со временем
          <div
            key={week[0]}
            className={`grid min-h-[88px] grid-cols-7 gap-y-0.5 pb-1 sm:min-h-[120px] ${w ? "border-t border-slate-100" : ""}`}
            style={{ gridTemplateRows: `30px ${lanes ? `repeat(${lanes}, 40px) ` : ""}minmax(52px, auto)` }}
          >
            {week.map((day, i) => (
              <div
                key={day}
                onClick={(e) => e.target === e.currentTarget && onCreate(day)}
                className={`-mb-1 cursor-pointer border-slate-100 p-1 sm:p-1.5 ${i ? "border-l" : ""} ${day.slice(0, 7) === month ? "" : "bg-slate-50/70"}`}
                style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
              >
                <Link
                  href={href("day", day)}
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    day === today
                      ? "bg-blue-600 font-semibold text-white"
                      : day.slice(0, 7) === month
                        ? "text-slate-800 hover:bg-slate-100"
                        : "text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {Number(day.slice(8))}
                </Link>
              </div>
            ))}
            {spans.map((s) => {
              const e = allDay.find((x) => x.id === s.id)!;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpen(e)}
                  style={{ gridColumn: `${s.first + 1} / ${s.last + 2}`, gridRow: s.lane + 2 }}
                  className={`relative z-10 mx-1 flex min-w-0 items-center gap-1 rounded-lg px-1.5 text-left text-xs font-medium sm:text-sm ${tone(e)} ${overdueRing(e, now).replace("ring-2", "ring-1")} ${
                    s.cutStart ? "-ml-px rounded-l-none" : ""
                  } ${s.cutEnd ? "-mr-px rounded-r-none" : ""}`}
                >
                  {e.kind === "MEETING" ? <Icon name="users" size={14} className="hidden shrink-0 sm:block" /> : <KindMark kind="TASK" done={e.done} />}
                  <span className={`truncate ${struck(e)}`}>{e.title}</span>
                </button>
              );
            })}
            {week.map((day, i) => {
              const list = events
                .filter((e) => !e.allDay && coversDay({ start: new Date(e.start), end: new Date(e.end) }, day))
                .sort((a, b) => a.start.localeCompare(b.start));
              const shown = list.slice(0, 3);
              return (
                <div key={day} className="relative z-10 flex min-w-0 flex-col gap-0.5 px-1 sm:px-1.5" style={{ gridColumn: i + 1, gridRow: lanes + 2 }}>
                  {shown.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onOpen(e)}
                      className={`flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11px] leading-4 hover:bg-slate-100 sm:text-xs ${
                        e.done ? `text-slate-400 ${struck(e)}` : ""
                      } ${overdueRing(e, now).replace("ring-2", "ring-1")}`}
                    >
                      <KindMark kind={e.kind} done={e.done} />
                      <span className="hidden shrink-0 text-slate-500 sm:inline">{timeLabel(minutesOfDay(new Date(e.start)))}</span>
                      <span className="truncate">{e.title}</span>
                    </button>
                  ))}
                  {list.length > shown.length && (
                    <Link href={href("day", day)} className="px-1 text-[11px] font-medium text-slate-500 hover:text-blue-600">
                      ещё {list.length - shown.length}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
