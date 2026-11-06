import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Icon } from "@/components/icons";
import { isKnowledgeKind } from "@/lib/knowledge";
import { KnowledgeForm } from "../knowledge-form";

export const dynamic = "force-dynamic";

// /documents/knowledge/new — новый материал (?kind= — раздел, из которого нажали «Добавить»), /documents/knowledge/<id> — материал
export default async function KnowledgePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { id } = await params;
  if (id === "new") {
    const kind = (await searchParams).kind;
    return (
      <Shell title="Новый материал">
        <KnowledgeForm id={null} initial={{ title: "", kind: isKnowledgeKind(kind) ? kind : "BRIEF", content: "" }} files={[]} />
      </Shell>
    );
  }
  const item = await db.knowledgeItem.findUnique({
    where: { id },
    include: { files: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, size: true } } },
  });
  if (!item) notFound();
  return (
    <Shell title="Материал базы знаний">
      <KnowledgeForm
        id={item.id}
        initial={{ title: item.title, kind: item.kind, content: item.content ?? "" }}
        files={item.files}
        author={item.author}
      />
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/documents?tab=knowledge"
          aria-label="К базе знаний"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-card hover:text-slate-800"
        >
          <Icon name="back" size={18} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}
