import Link from "next/link";
import type { KnowledgeKind } from "@prisma/client";
import { db } from "@/lib/db";
import { Icon } from "@/components/icons";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { shortDate } from "@/lib/contracts/fields";
import { KNOWLEDGE_KINDS, knowledgeLabel } from "@/lib/knowledge";
import { deleteKnowledge } from "./actions";

const base = "/documents?tab=knowledge";
const href = (kind: KnowledgeKind | null, q: string) => {
  const p = new URLSearchParams();
  if (kind) p.set("kind", kind);
  if (q) p.set("q", q);
  const rest = p.toString();
  return rest ? `${base}&${rest}` : base;
};

// Вкладка «База знаний»: материалы по разделам, поиск по названию и тексту
export async function KnowledgeList({ kind, q }: { kind: KnowledgeKind | null; q: string }) {
  const [items, counts] = await Promise.all([
    db.knowledgeItem.findMany({
      where: {
        ...(kind && { kind }),
        ...(q && { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { content: { contains: q, mode: "insensitive" as const } }] }),
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, title: true, kind: true, author: true, updatedAt: true, _count: { select: { files: true } } },
    }),
    db.knowledgeItem.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
  const count = new Map(counts.map((c) => [c.kind, c._count._all]));
  const total = counts.reduce((n, c) => n + c._count._all, 0);
  const chip = (active: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 whitespace-nowrap ${active ? "bg-slate-900 font-medium text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex max-w-full overflow-x-auto rounded-xl bg-white p-1 text-sm shadow-card" aria-label="Раздел базы знаний">
          <Link href={href(null, q)} aria-current={!kind ? "page" : undefined} className={chip(!kind)}>
            Все <span className="text-xs opacity-60">{total}</span>
          </Link>
          {KNOWLEDGE_KINDS.map((k) => (
            <Link key={k.kind} href={href(k.kind, q)} aria-current={kind === k.kind ? "page" : undefined} className={chip(kind === k.kind)}>
              {k.plural} <span className="text-xs opacity-60">{count.get(k.kind) ?? 0}</span>
            </Link>
          ))}
        </nav>
        <form action="/documents" className="flex min-w-0 flex-1 basis-56 items-center gap-2 rounded-xl bg-white px-3 shadow-card">
          <input type="hidden" name="tab" value="knowledge" />
          {kind && <input type="hidden" name="kind" value={kind} />}
          <Icon name="search" size={16} className="text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Найти в базе знаний"
            aria-label="Поиск по базе знаний"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </form>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {q
            ? "Ничего не нашлось. Попробуйте другое слово."
            : "Здесь пока пусто. Добавьте бриф, договор, КП, ТЗ, стандарт работы или скрипт ссылкой «+ Добавить материал» рядом с заголовком."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/60 bg-white shadow-card">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon name="document" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/documents/knowledge/${it.id}`} className="block truncate font-medium text-blue-700 hover:underline">
                  {it.title}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{knowledgeLabel(it.kind)}</span>
                  {it._count.files > 0 && (
                    <span className="flex items-center gap-1" title="Файлы">
                      <Icon name="clip" size={13} />
                      {it._count.files}
                    </span>
                  )}
                  <span>
                    изменён {shortDate(it.updatedAt)}
                    {it.author ? ` · ${it.author}` : ""}
                  </span>
                </p>
              </div>
              <ConfirmDeleteButton
                icon
                action={deleteKnowledge.bind(null, it.id)}
                label={`Удалить «${it.title}»`}
                what={`материал «${it.title}»`}
                message="Он попадёт в корзину вместе с файлами: оттуда его можно восстановить в течение 30 дней."
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
