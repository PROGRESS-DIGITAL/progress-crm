"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { DragHandle, haptic, useCoarsePointer } from "@/components/drag-handle";
import { useConfirm } from "@/components/confirm-dialog";
import type { BoardColumnData as Column, BoardTask as Task } from "@/lib/boards";
import { createColumn, deleteBoard, deleteColumn, moveTask, quickCreateTask, renameBoard, renameColumn } from "./actions";

type Employee = { id: string; name: string; avatar: string | null };

const DROP_ANIMATION: DropAnimation = {
  duration: 320,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};

const MSK = "Europe/Moscow";
const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: MSK });
const clock = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: MSK });

// Срок задачи на карточке: «6 нояб.», «6–8 нояб.» или «6 нояб., 14:00». У задачи на весь день конец — полночь следующего дня
function period(t: Task) {
  const start = new Date(t.start);
  if (!t.allDay) return `${shortDate.format(start)}, ${clock.format(start)}`;
  const last = new Date(new Date(t.end).getTime() - 1);
  const a = shortDate.format(start);
  const b = shortDate.format(last);
  return a === b ? a : `${a} – ${b}`;
}

const isOverdue = (t: Task) => !t.done && new Date(t.end).getTime() < Date.now();

export function TaskBoard({ boardId, columns: initial, employees }: { boardId: string; columns: Column[]; employees: Employee[] }) {
  const [columns, setColumns] = useState(initial);
  // Свежие данные с сервера (после revalidate) заменяют локальное состояние
  useEffect(() => setColumns(initial), [initial]);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();
  // Время сверяется только в браузере: иначе разметка сервера и браузера разойдётся на границе суток
  const [now, setNow] = useState(false);
  useEffect(() => setNow(true), []);
  // На телефоне карточку тянут за ручку в углу (сразу, без долгого нажатия), а тап открывает задачу
  const coarse = useCoarsePointer();
  const mouse = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
  const touch = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } });
  const finger = useSensor(PointerSensor, { activationConstraint: { distance: 2 } });
  const sensors = useSensors(coarse ? finger : mouse, touch);
  const [dragged, setDragged] = useState<{ task: Task; from: Column[] } | null>(null);
  const people = new Map(employees.map((e) => [e.id, e]));

  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    if (!hits.length) return closestCorners(args);
    const card = hits.find((h) => !columns.some((c) => c.id === h.id));
    return card ? [card] : hits;
  };
  const columnOf = (cols: Column[], id: string) => cols.find((c) => c.id === id || c.tasks.some((d) => d.id === id));

  function onDragStart(e: DragStartEvent) {
    // На телефоне карточку взяли за ручку: короткая вибрация
    if (coarse) haptic();
    for (const c of columns) {
      const task = c.tasks.find((d) => d.id === e.active.id);
      if (task) return setDragged({ task, from: columns });
    }
  }

  function onDragOver(e: DragOverEvent) {
    if (!e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    setColumns((cols) => {
      const from = columnOf(cols, activeId);
      const to = columnOf(cols, overId);
      if (!from || !to || from.id === to.id) return cols;
      const task = from.tasks.find((d) => d.id === activeId)!;
      const overIndex = to.tasks.findIndex((d) => d.id === overId);
      const index = overIndex === -1 ? to.tasks.length : overIndex;
      return cols.map((c) => {
        if (c.id === from.id) return { ...c, tasks: c.tasks.filter((d) => d.id !== activeId) };
        if (c.id === to.id) return { ...c, tasks: [...c.tasks.slice(0, index), task, ...c.tasks.slice(index)] };
        return c;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    if (coarse && e.over) haptic(15);
    const before = dragged?.from ?? columns;
    setDragged(null);
    const taskId = String(e.active.id);
    const column = columnOf(columns, taskId);
    if (!e.over || !column) return setColumns(before);
    const oldIndex = column.tasks.findIndex((d) => d.id === taskId);
    const overIndex = column.tasks.findIndex((d) => d.id === e.over!.id);
    const tasks = overIndex === -1 || overIndex === oldIndex ? column.tasks : arrayMove(column.tasks, oldIndex, overIndex);
    const order = tasks.map((d) => d.id);
    const was = columnOf(before, taskId)!;
    if (was.id === column.id && was.tasks.map((d) => d.id).join() === order.join()) return;
    setColumns((cols) => cols.map((c) => (c.id === column.id ? { ...c, tasks } : c)));
    startTransition(async () => {
      try {
        await moveTask(taskId, column.id, order);
      } catch {
        setColumns(before);
        alert("Не удалось перенести задачу, попробуйте ещё раз");
      }
    });
  }

  const card = (t: Task) => ({ task: t, boardId, coarse, overdue: now && isOverdue(t), assignee: t.assigneeId ? people.get(t.assigneeId) : undefined });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        if (dragged) setColumns(dragged.from);
        setDragged(null);
      }}
    >
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {columns.map((c) => (
          <BoardColumnView
            key={c.id}
            column={c}
            card={card}
            canDelete={columns.length > 1}
            firstOther={columns.find((x) => x.id !== c.id)?.name ?? ""}
            editing={editing === c.id}
            onEdit={(on) => setEditing(on ? c.id : null)}
            target={!!dragged && c.tasks.some((d) => d.id === dragged.task.id) && !dragged.from.find((f) => f.id === c.id)?.tasks.some((d) => d.id === dragged.task.id)}
          />
        ))}
        <button
          type="button"
          disabled={adding}
          onClick={() =>
            startAdding(async () => {
              const { id } = await createColumn(boardId);
              setEditing(id);
            })
          }
          title="Добавить столбец"
          aria-label="Добавить столбец"
          className="flex h-12 w-12 shrink-0 items-center justify-center self-start rounded-2xl border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-700 disabled:opacity-60"
        >
          <Icon name="plus" size={20} />
        </button>
      </div>
      <DragOverlay dropAnimation={DROP_ANIMATION}>
        {dragged && (
          <div className="deal-lift cursor-grabbing">
            <TaskCardBody {...card(dragged.task)} handle={coarse ? <DragHandle label="Перетащить задачу" /> : undefined} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

type CardProps = { task: Task; boardId: string; coarse: boolean; overdue: boolean; assignee?: Employee };

function BoardColumnView({
  column,
  card,
  canDelete,
  firstOther,
  editing,
  onEdit,
  target,
}: {
  column: Column;
  card: (t: Task) => CardProps;
  canDelete: boolean;
  firstOther: string;
  editing: boolean;
  onEdit: (on: boolean) => void;
  target: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  async function remove() {
    const n = column.tasks.length;
    const ok = await confirm({
      title: `Вы точно хотите удалить столбец «${column.name}»?`,
      text: n ? `Его задачи (${n}) переедут в «${firstOther}».` : undefined,
    });
    if (!ok) return;
    start(async () => {
      const r = await deleteColumn(column.id);
      if (r.error) alert(r.error);
    });
  }

  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${column.name}`}
      className={`flex w-64 shrink-0 flex-col rounded-2xl border border-t-4 border-slate-200/60 border-t-blue-500 bg-white/60 transition-[box-shadow,background-color] duration-200 ${target ? "bg-blue-50/60 ring-2 ring-blue-400" : "ring-0 ring-transparent"} ${pending ? "opacity-60" : ""}`}
    >
      <header className="flex items-center gap-1 px-3 pt-3 pb-2">
        {editing ? (
          <TitleInput value={column.name} label="Название столбца" save={(v) => renameColumn(column.id, v)} onDone={() => onEdit(false)} />
        ) : (
          <button
            type="button"
            onClick={() => onEdit(true)}
            title="Изменить название"
            className="min-w-0 flex-1 truncate rounded-md px-1 py-0.5 text-left text-sm font-semibold hover:bg-slate-100"
          >
            {column.name}
          </button>
        )}
        <span className="px-1 text-xs text-slate-500">{column.tasks.length}</span>
        {canDelete && !editing && (
          <button
            type="button"
            onClick={remove}
            title="Удалить столбец"
            aria-label={`Удалить столбец «${column.name}»`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Icon name="trash" size={15} />
          </button>
        )}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-3">
        <QuickTask columnId={column.id} />
        <SortableContext items={column.tasks.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map((d) => (
            <TaskItem key={d.id} {...card(d)} />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}

// Название правится на месте: Enter или клик мимо сохраняют, Esc отменяет
function TitleInput({
  value: initial,
  label,
  save,
  onDone,
  big,
}: {
  value: string;
  label: string;
  save: (v: string) => Promise<{ error?: string }>;
  onDone: () => void;
  big?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = useRef(false);

  function submit() {
    if (done.current) return;
    if (value.trim() === initial) {
      done.current = true;
      return onDone();
    }
    start(async () => {
      const r = await save(value);
      if (r.error) return setError(r.error);
      done.current = true;
      onDone();
    });
  }

  return (
    <div className={big ? "min-w-0" : "min-w-0 flex-1"}>
      <input
        autoFocus
        value={value}
        disabled={pending}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            done.current = true;
            onDone();
          }
        }}
        aria-label={label}
        maxLength={60}
        className={`w-full rounded-md border border-blue-400 bg-white outline-none ring-2 ring-blue-100 ${big ? "px-2 py-0.5 text-2xl font-semibold tracking-tight" : "px-1.5 py-0.5 text-sm font-semibold"}`}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function TaskItem(props: CardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging, transform, transition } = useSortable({ id: props.task.id });
  const router = useRouter();
  const style = { transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition };

  // На телефоне тянут только за ручку в углу, а тап по любому месту карточки открывает задачу
  if (props.coarse)
    return (
      <div
        ref={setNodeRef}
        style={style}
        onClick={() => router.push(`/tasks/${props.task.id}?board=${props.boardId}`)}
        className={`deal-settle rounded-xl ${isDragging ? "opacity-30" : ""}`}
      >
        <TaskCardBody
          {...props}
          handle={<DragHandle handleRef={setActivatorNodeRef} label="Перетащить задачу" {...listeners} {...attributes} />}
        />
      </div>
    );

  // Пока карточку тащат, на её месте остаётся бледный контур, а соседи плавно раздвигаются
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`deal-settle cursor-grab rounded-xl ${isDragging ? "opacity-30" : ""}`}
    >
      <TaskCardBody {...props} />
    </div>
  );
}

// Карточка как у сделки: название, клиент, сделка и счётчики, срок, исполнитель
function TaskCardBody({ task, boardId, overdue, assignee, handle }: CardProps & { handle?: ReactNode }) {
  const counters = [
    task.files > 0 && { icon: "clip" as const, n: task.files, title: "Файлы" },
    task.comments > 0 && { icon: "chat" as const, n: task.comments, title: "Комментарии" },
  ].filter((x) => !!x);
  return (
    <div className={`relative rounded-xl border bg-white p-3 shadow-card ${overdue ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-200/70"}`}>
      {handle}
      <div className={`flex items-start gap-1.5 ${handle ? "pr-7" : ""}`}>
        {task.done && <Icon name="check" size={16} className="mt-0.5 text-emerald-600" />}
        <Link
          href={`/tasks/${task.id}?board=${boardId}`}
          // Иначе браузер начинает тащить саму ссылку и карточка не переносится
          draggable={false}
          className={`block min-w-0 text-sm font-medium break-words hover:text-blue-700 ${task.done ? "text-slate-500 line-through" : ""}`}
        >
          {task.title}
        </Link>
      </div>
      {task.client && <p className="mt-0.5 truncate text-xs text-slate-600">{task.client}</p>}
      {(task.deal || counters.length > 0 || task.remind) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {task.deal ? <span className="min-w-0 truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{task.deal}</span> : <span />}
          <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
            {counters.map((c) => (
              <span key={c.icon} className="flex items-center gap-0.5" title={c.title}>
                <Icon name={c.icon} size={13} />
                {c.n}
              </span>
            ))}
            {task.remind && (
              <span title="Напомнит в Telegram">
                <Icon name="bell" size={13} />
              </span>
            )}
          </span>
        </div>
      )}
      {overdue && <p className="mt-1.5 text-[11px] font-medium text-rose-600">Просрочено</p>}
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        {assignee ? (
          <span className="flex min-w-0 items-center gap-1.5 text-slate-600" title="Исполнитель">
            <Avatar name={assignee.name} src={assignee.avatar} size={20} />
            <span className="truncate">{assignee.name}</span>
          </span>
        ) : (
          <span />
        )}
        <time dateTime={task.start} title="Срок" className="shrink-0">
          {period(task)}
        </time>
      </div>
    </div>
  );
}

// «+ Быстрая задача»: только название, остальное — в карточке задачи
function QuickTask({ columnId }: { columnId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-dashed border-slate-300 py-1.5 text-sm text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-700"
      >
        + Быстрая задача
      </button>
    );

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("title") ?? "");
        setError(null);
        start(async () => {
          const r = await quickCreateTask(columnId, value);
          if (r.error) return setError(r.error);
          // Форма остаётся открытой: так удобно добавить несколько задач подряд
          formRef.current?.reset();
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      className="flex flex-col gap-1.5 rounded-xl border border-blue-300 bg-white p-2 shadow-sm"
    >
      <textarea
        name="title"
        aria-label="Название задачи"
        placeholder="Что нужно сделать"
        autoFocus
        required
        rows={2}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        className="w-full resize-none rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {pending ? "Добавляю…" : "Добавить"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
          Отмена
        </button>
      </div>
    </form>
  );
}

// Шапка доски команды: название меняется кликом, корзинка удаляет доску, задачи уходят на основную
export function BoardTitle({ id, name, rename }: { id: string; name: string; rename: boolean }) {
  const [editing, setEditing] = useState(rename);
  const router = useRouter();

  return editing ? (
    <TitleInput
      big
      value={name}
      label="Название доски"
      save={(v) => renameBoard(id, v)}
      onDone={() => {
        setEditing(false);
        if (rename) router.replace(`/tasks/board/${id}`, { scroll: false });
      }}
    />
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Изменить название"
      className="min-w-0 truncate rounded-lg px-1 text-left text-2xl font-semibold tracking-tight hover:bg-slate-200/60"
    >
      {name}
    </button>
  );
}

// Удаление доски стоит в правом краю шапки, подальше от названия, чтобы не нажать случайно
export function DeleteBoardButton({ id, name, tasks }: { id: string; name: string; tasks: number }) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();

  async function remove() {
    const ok = await confirm({
      title: `Вы точно хотите удалить доску «${name}»?`,
      text: tasks ? `Её задачи (${tasks}) переедут на основную доску.` : undefined,
    });
    if (!ok) return;
    start(async () => {
      const r = await deleteBoard(id);
      if (r.error) return alert(r.error);
      router.push("/tasks/board");
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      title="Удалить доску"
      aria-label={`Удалить доску «${name}»`}
      className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
    >
      <Icon name="trash" size={17} />
    </button>
  );
}
