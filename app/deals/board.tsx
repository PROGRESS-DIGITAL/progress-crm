"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Service, StageKind } from "@prisma/client";
import { SERVICE_LABELS, formatRub } from "@/lib/format";
import { moveDeal } from "./actions";

type DealCard = {
  id: string;
  title: string;
  clientName: string;
  amount: number;
  service: Service;
  productName: string | null;
  owner: string | null;
  position: number;
};

type Column = { id: string; name: string; kind: StageKind; deals: DealCard[] };

const KIND_ACCENT: Record<StageKind, string> = {
  OPEN: "border-t-blue-500",
  WON: "border-t-emerald-500",
  LOST: "border-t-rose-400",
};

export function Board({ stages }: { stages: Column[] }) {
  const [columns, setColumns] = useState(stages);
  // Свежие данные с сервера (после revalidate) заменяют локальное состояние
  useEffect(() => setColumns(stages), [stages]);
  const [, startTransition] = useTransition();
  // Без порога перемещения клик по карточке сразу начинал бы перетаскивание
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
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
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {columns.map((c) => (
          <StageColumn key={c.id} column={c} />
        ))}
      </div>
    </DndContext>
  );
}

function StageColumn({ column }: { column: Column }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const total = column.deals.reduce((acc, d) => acc + d.amount, 0);

  return (
    <section
      ref={setNodeRef}
      data-testid={`stage-${column.name}`}
      className={`flex w-64 shrink-0 flex-col rounded-xl border border-t-4 border-slate-200 bg-slate-100/70 ${KIND_ACCENT[column.kind]} ${isOver ? "ring-2 ring-blue-400" : ""}`}
    >
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{column.name}</h2>
          <span className="text-xs text-slate-500">{column.deals.length}</span>
        </div>
        <p className="text-xs text-slate-500">{formatRub(total)}</p>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-3">
        {column.deals.map((d) => (
          <DealItem key={d.id} deal={d} />
        ))}
      </div>
    </section>
  );
}

function DealItem({ deal }: { deal: DealCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
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
      {deal.owner && <p className="mt-1 text-[11px] text-slate-500">Отв.: {deal.owner}</p>}
    </div>
  );
}
