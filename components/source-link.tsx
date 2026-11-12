import Link from "next/link";
import { Icon } from "@/components/icons";
import { KindMark } from "@/components/event-kind";
import type { SourceRef } from "@/lib/source-link";

const WITH = { DEAL: "Связано со сделкой", TASK: "Связано с задачей", MEETING: "Связано со встречей" } as const;

// Строка под названием сделки, задачи или встречи: с чем она связана и ссылка туда
export function SourceLink({ source, className = "" }: { source: SourceRef | null | undefined; className?: string }) {
  if (!source) return null;
  return (
    <div className={`flex min-w-0 items-center gap-1.5 text-sm ${className}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon name="link" size={14} />
      </span>
      <span className="shrink-0 text-slate-500">{WITH[source.kind]}</span>
      <Link
        href={source.href}
        className="flex min-w-0 items-center gap-1.5 rounded-md font-medium text-blue-600 hover:text-blue-700 hover:underline"
      >
        {source.kind === "DEAL" ? <Icon name="deals" size={14} className="text-slate-400" /> : <KindMark kind={source.kind} />}
        <span className="truncate">{source.title}</span>
      </Link>
    </div>
  );
}
