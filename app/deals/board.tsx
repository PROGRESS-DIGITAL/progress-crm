"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  defaultDropAnimationSideEffects,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import type { Service, StageKind } from "@prisma/client";
import { SERVICE_LABELS, formatRub } from "@/lib/format";
import { moveDeal, quickCreateDeal } from "./actions";
import { Avatar } from "@/components/avatar";

type DealCard = {
  id: string;
  title: string;
  clientName: string;
  amount: number;
  service: Service;
  productName: string | null;
  owner: string | null;
  startDate: string;
  expectedCloseDate: string | null;
  position: number;
};

const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });
const moscowDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });

// Просрочена: открытая сделка, у которой ожидаемая дата закрытия уже прошла (сравниваем дни по Москве)
function isOverdue(deal: DealCard, kind: StageKind) {
  return kind === "OPEN" && !!deal.expectedCloseDate && moscowDay(new Date(deal.expectedCloseDate)) < moscowDay(new Date());
}

type Column = { id: string; name: string; kind: StageKind; deals: DealCard[] };

const KIND_ACCENT: Record<StageKind, string> = {
  OPEN: "border-t-blue-500",
  WON: "border-t-emerald-500",
  LOST: "border-t-rose-400",
};

// Карточка плавно опускается на новое место, а место в колонке проявляется под ней
const DROP_ANIMATION: DropAnimation = {
  duration: 320,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};

export function Board({
  stages,
  clientNames,
  avatars,
}: {
  stages: Column[];
  clientNames: string[];
  avatars: Record<string, string>;
}) {
  const [columns, setColumns] = useState(stages);
  // Свежие данные с сервера (после revalidate) заменяют локальное состояние
  useEffect(() => setColumns(stages), [stages]);
  const [, startTransition] = useTransition();
  // Без порога перемещения клик по карточке сразу начинал бы перетаскивание
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // Сделка, которую сейчас тащат: её копия едет под курсором, а на старом месте остаётся контур
  const [dragged, setDragged] = useState<{ deal: DealCard; overdue: boolean } | null>(null);

  function onDragStart(e: DragStartEvent) {
    for (const c of columns) {
      const deal = c.deals.find((d) => d.id === e.active.id);
      if (deal) return setDragged({ deal, overdue: isOverdue(deal, c.kind) });
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setDragged(null);
    const dealId = String(e.active.id);
    const toStageId = e.over ? String(e.over.id) : null;
    if (!toStageId) return;

    const from = columns.find((c) => c.deals.some((d) => d.id === dealId));
    if (!from || from.id === toStageId) return;

    const deal = from.deals.find((d) => d.id === dealId)!;
    const target = columns.find((c) => c.id === toStageId)!;
    // Перенесённая сделка встаёт наверх колонки
    const position = (target.deals[0]?.position ?? 1) - 1;
    const moved = { ...deal, position };

    const previous = columns;
    setColumns((cols) =>
      cols.map((c) => {
        if (c.id === from.id) return { ...c, deals: c.deals.filter((d) => d.id !== dealId) };
        if (c.id === toStageId) return { ...c, deals: [moved, ...c.deals] };
        return c;
      }),
    );
    startTransition(async () => {
      try {
        await moveDeal(dealId, toStageId, position);
      } catch {
        setColumns(previous);
        alert("Не удалось перенести сделку, попробуйте ещё раз");
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragged(null)}>
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {columns.map((c) => (
          <StageColumn key={c.id} column={c} avatars={avatars} />
        ))}
      </div>
      <DragOverlay dropAnimation={DROP_ANIMATION}>
        {dragged && (
          <div className="deal-lift cursor-grabbing">
            <DealCardBody
              deal={dragged.deal}
              overdue={dragged.overdue}
              avatar={dragged.deal.owner ? avatars[dragged.deal.owner] : null}
            />
          </div>
        )}
      </DragOverlay>
      <datalist id="client-names">
        {clientNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </DndContext>
  );
}

function StageColumn({ column, avatars }: { column: Column; avatars: Record<string, string> }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const total = column.deals.reduce((acc, d) => acc + d.amount, 0);

  return (
    <section
      ref={setNodeRef}
      data-testid={`stage-${column.name}`}
      className={`flex w-64 shrink-0 flex-col rounded-2xl border border-t-4 border-slate-200/60 bg-white/60 transition-[box-shadow,background-color] duration-200 ${KIND_ACCENT[column.kind]} ${isOver ? "bg-blue-50/60 ring-2 ring-blue-400" : "ring-0 ring-transparent"}`}
    >
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{column.name}</h2>
          <span className="text-xs text-slate-500">{column.deals.length}</span>
        </div>
        <p className="text-xs text-slate-500">{formatRub(total)}</p>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-3">
        <QuickDeal stageId={column.id} />
        {column.deals.map((d) => (
          <DealItem key={d.id} deal={d} overdue={isOverdue(d, column.kind)} avatar={d.owner ? avatars[d.owner] : null} />
        ))}
      </div>
    </section>
  );
}

function DealItem({ deal, overdue, avatar }: { deal: DealCard; overdue: boolean; avatar: string | null }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });

  // Пока карточку тащат, на её месте остаётся бледный контур
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`deal-settle cursor-grab rounded-xl transition-opacity duration-200 ${isDragging ? "opacity-30" : ""}`}
    >
      <DealCardBody deal={deal} overdue={overdue} avatar={avatar} />
    </div>
  );
}

function DealCardBody({ deal, overdue, avatar }: { deal: DealCard; overdue: boolean; avatar: string | null }) {
  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-card ${overdue ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-200/70"}`}
    >
      <Link href={`/deals/${deal.id}`} className="block text-sm font-medium hover:text-blue-700">
        {deal.title}
      </Link>
      <p className="mt-0.5 text-xs text-slate-600">{deal.clientName}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="mr-2 truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
          {deal.productName ?? SERVICE_LABELS[deal.service]}
        </span>
        <span className="text-sm font-semibold tabular-nums">{formatRub(deal.amount)}</span>
      </div>
      {overdue && (
        <p className="mt-1.5 text-[11px] font-medium text-rose-600">
          Просрочено: закрыть до {shortDate.format(new Date(deal.expectedCloseDate!))}
        </p>
      )}
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        {deal.owner ? (
          <span className="flex min-w-0 items-center gap-1.5 text-slate-600" title="Ответственный">
            <Avatar name={deal.owner} src={avatar} size={20} />
            <span className="truncate">{deal.owner}</span>
          </span>
        ) : (
          <span />
        )}
        <time dateTime={deal.startDate} title="Дата начала" className="shrink-0">
          с {shortDate.format(new Date(deal.startDate))}
        </time>
      </div>
    </div>
  );
}

// «Быстрая сделка»: название, клиент и сумма прямо в колонке; остальное заполняется в карточке сделки
function QuickDeal({ stageId }: { stageId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-dashed border-slate-300 py-1.5 text-sm text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-700"
      >
        + Быстрая сделка
      </button>
    );
  }

  const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const data = {
          title: String(f.get("title") ?? ""),
          clientName: String(f.get("clientName") ?? ""),
          amount: String(f.get("amount") || "0"),
        };
        setError(null);
        startTransition(async () => {
          const result = await quickCreateDeal(stageId, data);
          if (result.error) setError(result.error);
          else {
            formRef.current?.reset();
            setOpen(false);
          }
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      className="flex flex-col gap-1.5 rounded-xl border border-blue-300 bg-white p-2 shadow-sm"
    >
      <input name="title" aria-label="Название сделки" placeholder="Название сделки" autoFocus required className={input} />
      <input
        name="clientName"
        aria-label="Клиент"
        placeholder="Клиент"
        list="client-names"
        autoComplete="off"
        required
        className={input}
      />
      <input name="amount" aria-label="Сумма, ₽" placeholder="Сумма, ₽" inputMode="numeric" className={input} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Добавляю…" : "Добавить"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
          Отмена
        </button>
      </div>
    </form>
  );
}
