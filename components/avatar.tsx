// Кружок с аватаром; без фото — инициалы на цветном фоне, цвет постоянный для имени
const COLORS = ["bg-blue-500", "bg-emerald-500", "bg-sky-500", "bg-orange-400", "bg-violet-500", "bg-rose-400"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Avatar({ name, src, size = 24 }: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- data URL, оптимизировать нечего
    return <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  const color = COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span
      aria-hidden
      style={style}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white ${color}`}
    >
      {initials(name) || "?"}
    </span>
  );
}
