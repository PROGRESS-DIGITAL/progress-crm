"use client";

import { useEffect, useRef, useState } from "react";

const VIEW = 280; // сторона окна кадрирования на экране
const OUT = 256; // сторона сохраняемой картинки
const MAX_ZOOM = 5;

type Point = { x: number; y: number };

// Окно кадрирования: фото двигается пальцем или мышью, колесо и ползунок приближают.
// Сохраняется ровно то, что видно в круге, поэтому лицо можно вырезать из фото в полный рост
export function AvatarCropper({
  src,
  onCancel,
  onDone,
}: {
  src: string;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Point>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const base = size ? VIEW / Math.min(size.w, size.h) : 1;
  const scale = base * zoom;

  // Фото всегда закрывает круг целиком: без пустых краёв
  function clamp(p: Point, s = scale): Point {
    if (!size) return p;
    return {
      x: Math.min(0, Math.max(VIEW - size.w * s, p.x)),
      y: Math.min(0, Math.max(VIEW - size.h * s, p.y)),
    };
  }

  function zoomTo(next: number, center: Point = { x: VIEW / 2, y: VIEW / 2 }) {
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    const s = base * z;
    // Точка под курсором или в центре остаётся на месте
    const p = { x: center.x - ((center.x - pos.x) / scale) * s, y: center.y - ((center.y - pos.y) / scale) * s };
    setZoom(z);
    setPos(clamp(p, s));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function onLoad() {
    const img = imgRef.current!;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const s = VIEW / Math.min(w, h);
    setSize({ w, h });
    // По умолчанию кадр по центру, у вертикального фото ближе к верху, где обычно лицо
    setPos({ x: (VIEW - w * s) / 2, y: h > w ? Math.max(VIEW - h * s, -(h * s) * 0.1) : (VIEW - h * s) / 2 });
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      zoomTo((pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist);
      return;
    }
    setPos((p) => clamp({ x: p.x + now.x - prev.x, y: p.y + now.y - prev.y }));
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    zoomTo(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function save() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = OUT;
    const side = VIEW / scale;
    canvas.getContext("2d")!.drawImage(imgRef.current!, -pos.x / scale, -pos.y / scale, side, side, 0, 0, OUT, OUT);
    onDone(canvas.toDataURL("image/jpeg", 0.88));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Кадрирование фото"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Выберите кадр</h2>
        <p className="mt-1 text-sm text-slate-500">Двигайте фото и приближайте, чтобы лицо было в круге.</p>

        <div
          className="relative mx-auto mt-4 cursor-grab touch-none overflow-hidden rounded-2xl bg-slate-900 select-none active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          data-testid="crop-area"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- локальный файл, оптимизировать нечего */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onLoad}
            draggable={false}
            className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              visibility: size ? "visible" : "hidden",
            }}
          />
          {/* Затемнение вокруг круга: так видно, что попадёт в аватар */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: "0 0 0 9999px rgb(15 23 42 / 0.55)", outline: "2px solid white" }}
          />
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm text-slate-600">
          <span>−</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            aria-label="Масштаб"
            className="flex-1 accent-blue-600"
          />
          <span>+</span>
        </label>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!size}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
