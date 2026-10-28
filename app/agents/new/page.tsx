import Link from "next/link";
import { SCOPES, ALL_SCOPES } from "@/lib/agents/tools";
import { AgentForm } from "../agent-form";

export default function NewAgentPage() {
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href="/agents" className="text-sm text-slate-500 hover:text-slate-800">
        ← AI агенты
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Новый агент</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">Задайте роль, инструкции и разделы CRM, с которыми агент будет работать</p>
      <AgentForm
        id={null}
        initial={{ name: "", description: "", instructions: "", scopes: ALL_SCOPES.filter((s) => s !== "edit") }}
        scopes={SCOPES.map(({ key, label, hint }) => ({ key, label, hint }))}
      />
    </div>
  );
}
