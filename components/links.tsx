"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { KindMark } from "@/components/event-kind";
import { linkEntities, unlinkEntities } from "@/app/links/actions";
import { targetKey, targetOf, type LinkKind, type LinkOption, type LinkOptions, type LinkRow, type LinkTarget } from "@/lib/link-types";

const WITH: Record<LinkKind, string> = { DEAL: "Связано со сделкой", TASK: "Связано с задачей", MEETING: "Связано со встречей" };

// Связи карточки. У сохранённой записи (self) каждое изменение сразу уходит на сервер,
// у новой копится в форме и сохраняется вместе с ней (targets)
export function useLinks(self: LinkTarget | null, initial: LinkRow[]) {
  const router = useRouter();
  const [links, setLinks] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Сервер прислал свежие связи (например, после правки в другом блоке карточки)
  useEffect(() => setLinks(initial), [initial]);

  function add(kind: LinkKind, option: LinkOption) {
    setError(null);
    if (links.some((l) => l.targetId === option.id)) return;
    if (!self) {
      setLinks((p) => [...p, { id: `draft:${option.id}`, kind, targetId: option.id, title: option.title, href: option.href }]);
      return;
    }
    start(async () => {
      const res = await linkEntities(self, targetOf(kind, option.id));
      if (res.error) return setError(res.error);
      if (res.link) setLinks((p) => [...p.filter((l) => l.id !== res.link!.id), res.link!]);
      router.refresh();
    });
  }

  function remove(row: LinkRow) {
    setError(null);
    setLinks((p) => p.filter((l) => l.id !== row.id));
    if (!self) return;
    start(async () => {
      const res = await unlinkEntities(row.id);
      if (res.error) setError(res.error);
      router.refresh();
    });
  }

  const targets = links.map((l) => targetOf(l.kind, l.targetId));
  return { links, add, remove, error, pending, targets };
}

export type LinksState = ReturnType<typeof useLinks>;

// Список связей под названием: значок-цепочка, с чем связано и ссылка туда, каждая связь строкой ниже
export function LinkList({ links, onRemove, className = "" }: { links: LinkRow[]; onRemove?: (row: LinkRow) => void; className?: string }) {
  if (!links.length) return null;
  return (
    <ul className={`flex flex-col gap-1.5 ${className}`}>
      {links.map((l) => (
        <li key={l.id} className="group flex min-w-0 items-center gap-1.5 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon name="link" size={14} />
          </span>
          <span className="shrink-0 text-slate-500">{WITH[l.kind]}</span>
          <Link href={l.href} className="flex min-w-0 items-center gap-1.5 font-medium text-blue-600 hover:text-blue-700 hover:underline">
            {l.kind === "DEAL" ? <Icon name="deals" size={14} className="text-slate-400" /> : <KindMark kind={l.kind} />}
            <span className="truncate">{l.title}</span>
          </Link>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(l)}
              aria-label={`Убрать связь с «${l.title}»`}
              title="Убрать связь"
              className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const PICKERS: { kind: LinkKind; key: keyof LinkOptions; label: string; empty: string }[] = [
  { kind: "DEAL", key: "deals", label: "Связать со сделкой", empty: "Выберите сделку" },
  { kind: "TASK", key: "tasks", label: "Связать с задачей", empty: "Выберите задачу" },
  { kind: "MEETING", key: "meetings", label: "Связать со встречей", empty: "Выберите встречу" },
];

// Три списка: сделки, задачи и встречи. Выбор сразу добавляет связь, а список снова пустеет
export function LinkPicker({
  state,
  options,
  selfId,
  fieldClass,
  labelClass,
  grid = false,
}: {
  state: LinksState;
  options: LinkOptions;
  selfId?: string | null;
  fieldClass: string;
  labelClass: string;
  // В окне встречи три списка стоят в ряд на широком экране
  grid?: boolean;
}) {
  const taken = new Set(state.links.map((l) => l.targetId));
  return (
    <div className={grid ? "grid gap-3 sm:grid-cols-3" : "flex flex-col gap-3"}>
      {PICKERS.map((p) => {
        const list = options[p.key].filter((o) => o.id !== selfId && !taken.has(o.id));
        return (
          <label key={p.kind} className={labelClass}>
            {p.label}
            <select
              value=""
              disabled={state.pending}
              onChange={(e) => {
                const option = options[p.key].find((o) => o.id === e.target.value);
                if (option) state.add(p.kind, option);
              }}
              className={fieldClass}
            >
              <option value="">{list.length ? p.empty : "Нечего связать"}</option>
              {list.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                  {o.hint ? ` · ${o.hint}` : ""}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
    </div>
  );
}

// Связи новой сделки уходят с формой скрытыми полями: «deal:<id>» или «event:<id>»
export function LinkInputs({ targets, form }: { targets: LinkTarget[]; form: string }) {
  return (
    <>
      {targets.map((t) => (
        <input key={targetKey(t)} type="hidden" name="link" value={targetKey(t)} form={form} />
      ))}
    </>
  );
}
