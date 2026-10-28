"use client";

import { useRouter } from "next/navigation";

// На телефоне агенты переключаются списком в шапке чата
export function AgentSwitcher({ agents, current }: { agents: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => router.push(`/agents/${e.target.value}`)}
      aria-label="Агент"
      className="h-9 w-full max-w-full truncate rounded-xl border border-slate-200 bg-white pr-8 pl-3 text-base font-semibold sm:text-sm"
    >
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
