"use client";

// Время всегда в 24-часовом формате: два списка, часы и минуты.
// Нативное поле времени показывает AM/PM, если так настроена система, поэтому своё
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export function TimeField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [h = "09", m = "00"] = value.split(":");
  // Время, перенесённое мышкой в календаре, может быть не кратно пяти минутам: оставляем его в списке
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();
  // Общая стрелка списков (globals.css) здесь лишняя: поле одно, а списков два
  const select = "cursor-pointer bg-transparent bg-none! px-0.5! tabular-nums outline-none";

  return (
    <div className="mt-1 flex w-full items-center rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
      <select aria-label={`${label}, часы`} value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)} className={select}>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span className="text-slate-400">:</span>
      <select aria-label={`${label}, минуты`} value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)} className={select}>
        {minutes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}
