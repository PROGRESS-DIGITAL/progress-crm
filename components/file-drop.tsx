"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";

// Перетаскивают ли именно файлы с компьютера, а не текст или карточку с доски
function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

// Подходит ли файл под accept, как у <input type="file">: «.pdf», «image/*», «image/png»
export function fileMatches(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .some((t) => (t.startsWith(".") ? name.endsWith(t) : t.endsWith("/*") ? type.startsWith(t.slice(0, -1)) : type === t));
}

// Кладёт брошенные файлы в обычное поле <input type="file">, чтобы форма отправила их как выбранные кнопкой
export function putFiles(input: HTMLInputElement | null, files: File[]) {
  if (!input) return;
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  input.files = dt.files;
}

// Первое поле выбора файла внутри области: если onFiles не передан, файлы попадают в него
function fileInput(root: HTMLElement | null) {
  return root?.querySelector<HTMLInputElement>('input[type="file"]') ?? null;
}

// Область, куда можно бросить файлы мышкой. Пока файлы над ней, поверх появляется подсветка с подсказкой.
// Без onFiles файлы кладутся в поле <input type="file"> внутри области, и срабатывает его onChange — как будто
// файл выбрали кнопкой. accept и multiple тогда берутся у этого поля. Неподходящие по типу файлы отбрасываются,
// а если не подошёл ни один, область на пару секунд говорит об этом. Размер и загрузку проверяет сама форма
export function FileDrop({
  onFiles,
  disabled,
  accept,
  multiple = true,
  hint = "Отпустите, чтобы прикрепить",
  note,
  wrongType = "Этот файл сюда не подходит",
  compact,
  as: Tag = "div",
  className = "",
  children,
}: {
  onFiles?: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
  hint?: string;
  // Вторая строка подсказки, например лимит размера
  note?: string;
  // Что показать, если бросили файл не того типа
  wrongType?: string;
  // Для небольших областей: подсказка в одну строку, без большой иконки
  compact?: boolean;
  as?: "div" | "section";
  className?: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState(false);
  // dragenter/dragleave приходят и от вложенных элементов: считаем глубину, чтобы подсветка не мигала
  const depth = useRef(0);
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!rejected) return;
    const t = setTimeout(() => setRejected(false), 2500);
    return () => clearTimeout(t);
  }, [rejected]);

  const tone = rejected ? "border-rose-400 bg-rose-50/95 text-rose-700" : "border-blue-400 bg-blue-50/90 text-blue-700";

  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        root.current = el;
      }}
      className={`relative ${className}`}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        if (!disabled) {
          setRejected(false);
          setOver(true);
        }
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        // Без preventDefault браузер не даст бросить файл и откроет его вместо страницы
        e.preventDefault();
        e.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        if (disabled) return;
        const input = onFiles ? null : fileInput(root.current);
        if (input?.disabled) return;
        const types = accept ?? (input?.accept || undefined);
        const many = input ? input.multiple : multiple;
        const dropped = Array.from(e.dataTransfer.files);
        const fit = dropped.filter((f) => fileMatches(f, types));
        if (dropped.length > 0 && fit.length === 0) return setRejected(true);
        if (fit.length === 0) return;
        const chosen = many ? fit : fit.slice(0, 1);
        if (onFiles) return onFiles(chosen);
        if (!input) return;
        putFiles(input, chosen);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    >
      {children}
      {(over || rejected) && (
        <div
          aria-hidden={!rejected}
          role={rejected ? "alert" : undefined}
          className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] border-2 border-dashed text-center font-medium backdrop-blur-[1px] ${tone} ${
            compact ? "gap-1.5 px-2 text-xs" : "flex-col gap-2 p-4 text-sm"
          }`}
        >
          {compact ? (
            <Icon name={rejected ? "close" : "clip"} size={14} className="shrink-0" />
          ) : (
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${rejected ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"}`}>
              <Icon name={rejected ? "close" : "clip"} size={20} />
            </span>
          )}
          <span>{rejected ? wrongType : hint}</span>
          {note && !compact && !rejected && <span className="text-xs font-normal text-blue-600/80">{note}</span>}
        </div>
      )}
    </Tag>
  );
}
