import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PLACEHOLDER_GROUPS } from "@/lib/contracts/fields";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { deleteTemplate, saveTemplate } from "../../actions";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await db.contractTemplate.findUnique({ where: { id }, include: { _count: { select: { contracts: true } } } });
  if (!template) notFound();
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/documents?tab=templates" className="text-sm text-blue-600 hover:underline">
            ← Шаблоны
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Шаблон договора</h1>
          <p className="mt-1 text-sm text-slate-600">
            Поля в фигурных скобках, например {"{{клиент.инн}}"}, заменятся данными клиента и сделки при создании договора.
          </p>
        </div>
        <ConfirmDeleteButton
          action={deleteTemplate.bind(null, template.id)}
          what={`шаблон «${template.name}»`}
          message={
            template._count.contracts
              ? "Уже созданные по нему договоры останутся."
              : "Это действие нельзя отменить."
          }
        />
      </div>
      <TemplateEditor action={saveTemplate.bind(null, template.id)} name={template.name} body={template.body} placeholders={PLACEHOLDER_GROUPS} />
    </div>
  );
}
