// Значок вида события: задача — квадратный чекбокс, встреча — круглая точка.
// Форма и цвет разные, чтобы задачи и встречи различались с первого взгляда
export function KindMark({ kind, done = false, className = "" }: { kind: "MEETING" | "TASK"; done?: boolean; className?: string }) {
  if (kind === "MEETING") return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${done ? "bg-slate-300" : "bg-blue-500"} ${className}`} />;
  return (
    <span
      className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] ${
        done ? "border-slate-400 bg-slate-400 text-white" : "border-amber-500"
      } ${className}`}
    >
      {done && <Tick size={9} />}
    </span>
  );
}

export function Tick({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
