import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { db } from "@/lib/db";
import { SCOPES } from "@/lib/agents/tools";
import { deleteAgent } from "../../actions";
import { AgentForm } from "../../agent-form";

export const dynamic = "force-dynamic";

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({ where: { id }, include: { _count: { select: { chats: true } } } });
  if (!agent) notFound();

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href={`/agents/${agent.id}`} className="text-sm text-slate-500 hover:text-slate-800">
        ← {agent.name}
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Настройки агента</h1>
          <p className="mt-1 text-sm text-slate-600">Изменения действуют со следующего вопроса</p>
        </div>
        {!agent.isDefault && (
          <ConfirmDeleteButton
            action={deleteAgent.bind(null, agent.id)}
            what={`агента «${agent.name}»`}
            message={agent._count.chats ? `Вместе с ним удалится история чатов: ${agent._count.chats}.` : undefined}
            label="Удалить агента"
          />
        )}
      </div>
      <AgentForm
        id={agent.id}
        isDefault={agent.isDefault}
        initial={{ name: agent.name, description: agent.description ?? "", website: agent.website ?? "", instructions: agent.instructions, scopes: agent.scopes }}
        scopes={SCOPES.map(({ key, label, hint }) => ({ key, label, hint }))}
      />
    </div>
  );
}
