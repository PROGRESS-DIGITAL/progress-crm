"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { useConfirm } from "@/components/confirm-dialog";
import { createColumn, deleteCard, deleteColumn, moveCard, quickCreateCard, renameColumn, updateCard } from "./actions";

type Card = { id: string; title: string; notes: string | null; assigneeId: string | null };
type Column = { id: string; name: string; cards: Card[] };
type Employee = { id: string; name: string; avatar: string | null };

const DROP_ANIMATION: DropAnimation = {
  duration: 320,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};

export function TaskBoard({ columns: initial, employees, openCardId }: { columns: Column[]; employees: Employee[]; openCardId: string | null }) {
  const [columns, setColumns] = useState(initial);
  // Свежие данные с сервера (после revalidate) заменяют локальное состояние
  useEffect(() => setColumns(initial), [initial]);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(openCardId);
  const [adding, startAdding] = useTransition();
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // На телефоне карточку берут долгим нажатием, чтобы доска листалась пальцем
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );
  const [dragged, setDragged] = useState<{ card: Card; from: Column[] } | null>(null);
  const people = new Map(employees.map((e) => [e.id, e]));

  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    if (!hits.length) return closestCorners(args);
    const card = hits.find((h) => !columns.some((c) => c.id === h.id));
    return card ? [card] : hits;
  };
  const columnOf = (cols: Column[], id: string) => cols.find((c) => c.id === id || c.cards.some((d) => d.id === id));

  function onDragStart(e: DragStartEvent) {
    for (const c of columns) {
      const card = c.cards.find((d) => d.id === e.active.id);
      if (card) return setDragged({ card, from: columns });
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
      const card = from.cards.find((d) => d.id === activeId)!;
      const overIndex = to.cards.findIndex((d) => d.id === overId);
      const index = overIndex === -1 ? to.cards.length : overIndex;
      return cols.map((c) => {
        if (c.id === from.id) return { ...c, cards: c.cards.filter((d) => d.id !== activeId) };
        if (c.id === to.id) return { ...c, cards: [...c.cards.slice(0, index), card, ...c.cards.slice(index)] };
        return c;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const before = dragged?.from ?? columns;
    setDragged(null);
    const cardId = String(e.active.id);
    const column = columnOf(columns, cardId);
    if (!e.over || !column) return setColumns(before);
    const oldIndex = column.cards.findIndex((d) => d.id === cardId);
    const overIndex = column.cards.findIndex((d) => d.id === e.over!.id);
    const cards = overIndex === -1 || overIndex === oldIndex ? column.cards : arrayMove(column.cards, oldIndex, overIndex);
    const order = cards.map((d) => d.id);
    const was = columnOf(before, cardId)!;
    if (was.id === column.id && was.cards.map((d) => d.id).join() === order.join()) return;
    setColumns((cols) => cols.map((c) => (c.id === column.id ? { ...c, cards } : c)));
    startTransition(async () => {
      try {
        await moveCard(cardId, column.id, order);
      } catch {
        setColumns(before);
        alert("Не удалось перенести карточку, попробуйте ещё раз");
      }
    });
  }

  const openCard = columns.flatMap((c) => c.cards.map((card) => ({ card, column: c.name }))).find((x) => x.card.id === opened);

  function closeCard() {
    setOpened(null);
    // Убираем ?card= из адреса, чтобы обновление страницы не открывало карточку снова
    if (openCardId) router.replace("/tasks/board", { scroll: false });
  }

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
      <div className="flex flex-1 items-start gap-4 overflow-x-auto pb-4">
        {columns.map((c) => (
          <BoardColumnView
            key={c.id}
            column={c}
            people={people}
            canDelete={columns.length > 1}
            firstOther={columns.find((x) => x.id !== c.id)?.name ?? ""}
            editing={editing === c.id}
            onEdit={(on) => setEditing(on ? c.id : null)}
            onOpen={setOpened}
            target={!!dragged && c.cards.some((d) => d.id === dragged.card.id) && !dragged.from.find((f) => f.id === c.id)?.cards.some((d) => d.id === dragged.card.id)}
          />
        ))}
        <button
          type="button"
          disabled={adding}
          onClick={() =>
            startAdding(async () => {
              const { id } = await createColumn();
              setEditing(id);
            })
          }
          title="Добавить столбец"
          aria-label="Добавить столбец"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-700 disabled:opacity-60"
        >
          <Icon name="plus" size={20} />
        </button>
      </div>
      <DragOverlay dropAnimation={DROP_ANIMATION}>
        {dragged && (
          <div className="deal-lift cursor-grabbing">
            <CardBody card={dragged.card} assignee={dragged.card.assigneeId ? people.get(dragged.card.assigneeId) : undefined} />
          </div>
        )}
      </DragOverlay>
      {openCard && <CardDialog key={openCard.card.id} card={openCard.card} column={openCard.column} employees={employees} onClose={closeCard} />}
    </DndContext>
  );
}

function BoardColumnView({
  column,
  people,
  canDelete,
  firstOther,
  editing,
  onEdit,
  onOpen,
  target,
}: {
  column: Column;
  people: Map<string, Employee>;
  canDelete: boolean;
  firstOther: string;
  editing: boolean;
  onEdit: (on: boolean) => void;
  onOpen: (id: string) => void;
  target: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  async function remove() {
    const n = column.cards.length;
    const ok = await confirm({
      title: `Вы точно хотите удалить столбец «${column.name}»?`,
      text: n ? `Его карточки (${n}) переедут в «${firstOther}».` : undefined,
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
      className={`flex w-64 shrink-0 flex-col rounded-2xl border border-t-4 border-slate-200/60 border-t-blue-500 bg-white/60 transition-[box-shadow,background-color] duration-200 ${target ? "bg-blue-50/60 ring-2 ring-blue-400" : ""} ${pending ? "opacity-60" : ""}`}
    >
      <header className="flex items-center gap-1 px-3 pt-3 pb-2">
        {editing ? (
          <ColumnTitleInput column={column} onDone={() => onEdit(false)} />
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
        <span className="px-1 text-xs text-slate-500">{column.cards.length}</span>
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
        <QuickCard columnId={column.id} />
        <SortableContext items={column.cards.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((d) => (
            <CardItem key={d.id} card={d} assignee={d.assigneeId ? people.get(d.assigneeId) : undefined} onOpen={() => onOpen(d.id)} />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}

// Название столбца правится прямо в шапке: Enter или клик мимо сохраняют, Esc отменяет
function ColumnTitleInput({ column, onDone }: { column: Column; onDone: () => void }) {
  const [value, setValue] = useState(column.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = useRef(false);

  function save() {
    if (done.current) return;
    if (value.trim() === column.name) {
      done.current = true;
      return onDone();
    }
    start(async () => {
      const r = await renameColumn(column.id, value);
      if (r.error) return setError(r.error);
      done.current = true;
      onDone();
    });
  }

  return (
    <div className="min-w-0 flex-1">
      <input
        autoFocus
        value={value}
        disabled={pending}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            done.current = true;
            onDone();
          }
        }}
        aria-label="Название столбца"
        maxLength={60}
        className="w-full rounded-md border border-blue-400 bg-white px-1.5 py-0.5 text-sm font-semibold outline-none ring-2 ring-blue-100"
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function CardItem({ card, assignee, onOpen }: { card: Card; assignee?: Employee; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
      className={`deal-settle cursor-grab rounded-xl ${isDragging ? "opacity-30" : ""}`}
    >
      <CardBody card={card} assignee={assignee} />
    </div>
  );
}

function CardBody({ card, assignee }: { card: Card; assignee?: Employee }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-3 shadow-card hover:border-blue-300">
      <p className="text-sm font-medium break-words">{card.title}</p>
      {card.notes && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{card.notes}</p>}
      {assignee && (
        <span className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-600" title="Исполнитель">
          <Avatar name={assignee.name} src={assignee.avatar} size={20} />
          <span className="truncate">{assignee.name}</span>
        </span>
      )}
    </div>
  );
}

// «+ Карточка»: только название, остальное — в окне карточки
function QuickCard({ columnId }: { columnId: string }) {
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
        + Карточка
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
          const r = await quickCreateCard(columnId, value);
          if (r.error) return setError(r.error);
          // Форма остаётся открытой: так удобно добавить несколько карточек подряд
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
        aria-label="Название карточки"
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

function CardDialog({ card, column, employees, onClose }: { card: Card; column: string; employees: Employee[]; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const confirm = useConfirm();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  async function remove() {
    if (!(await confirm({ title: `Вы точно хотите удалить карточку «${card.title}»?`, text: "Она попадёт в корзину: оттуда её можно восстановить в течение 30 дней." })))
      return;
    start(async () => {
      await deleteCard(card.id);
      onClose();
    });
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        role="dialog"
        aria-label="Карточка"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const data = { title: String(f.get("title") ?? ""), notes: String(f.get("notes") ?? ""), assigneeId: String(f.get("assigneeId") ?? "") };
          setError(null);
          start(async () => {
            const r = await updateCard(card.id, data);
            if (r.error) setError(r.error);
            else onClose();
          });
        }}
        className="flex max-h-[90vh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Столбец «{column}»</p>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="text-slate-400 hover:text-slate-700">
            <Icon name="close" size={18} />
          </button>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Название</span>
          <input name="title" defaultValue={card.title} required maxLength={200} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Описание</span>
          <textarea name="notes" defaultValue={card.notes ?? ""} rows={5} maxLength={5000} className={input} placeholder="Подробности, ссылки, критерии готовности" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Исполнитель</span>
          <select name="assigneeId" defaultValue={card.assigneeId ?? ""} className={input}>
            <option value="">Не назначен</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={remove} disabled={pending} className="text-sm text-rose-600 hover:text-rose-800">
            Удалить
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
              Отмена
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {pending ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
