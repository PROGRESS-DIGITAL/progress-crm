"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";

// Перетаскивают ли именно файлы с компьютера, а не текст или карточку с доски
function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

// Область, куда можно бросить файлы мышкой. Пока файлы над ней, поверх появляется подсветка с подсказкой.
// Проверки размера и загрузку делает тот, кто передал onFiles, как и для кнопки «Прикрепить»
export function FileDrop({
  onFiles,
  disabled,
  hint = "Отпустите, чтобы прикрепить",
  note,
  as: Tag = "div",
  className = "",
  children,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  hint?: string;
  // Вторая строка подсказки, например лимит размера
  note?: string;
  as?: "div" | "section";
  className?: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  // dragenter/dragleave приходят и от вложенных элементов: считаем глубину, чтобы подсветка не мигала
  const depth = useRef(0);

  function reset() {
    depth.current = 0;
    setOver(false);
  }

  return (
    <Tag
      className={`relative ${className}`}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        if (!disabled) setOver(true);
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
        reset();
        const files = Array.from(e.dataTransfer.files);
        if (!disabled && files.length > 0) onFiles(files);
      }}
    >
      {children}
      {over && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-blue-400 bg-blue-50/90 p-4 text-center text-sm font-medium text-blue-700 backdrop-blur-[1px]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Icon name="clip" size={20} />
          </span>
          {hint}
          {note && <span className="text-xs font-normal text-blue-600/80">{note}</span>}
        </div>
      )}
    </Tag>
  );
}
