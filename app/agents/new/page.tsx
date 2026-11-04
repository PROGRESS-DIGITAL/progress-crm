import Link from "next/link";
import { SCOPES, ALL_SCOPES } from "@/lib/agents/tools";
import { ENGINES, enginesReady } from "@/lib/agents/agent";
import { AgentForm } from "../agent-form";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  const ready = await enginesReady();
  // Новый агент по умолчанию на той модели, что подключена: Claude, если есть его ключ
  const engine = ready.claude || !ready.yandex ? "claude" : "yandex";
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href="/agents" className="text-sm text-slate-500 hover:text-slate-800">
        ← AI агенты
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Новый агент</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">Задайте роль, инструкции и разделы CRM, с которыми агент будет работать</p>
      <AgentForm
        id={null}
        initial={{ name: "", description: "", website: "", instructions: "", scopes: ALL_SCOPES.filter((s) => s !== "edit"), engine }}
        scopes={SCOPES.map(({ key, label, hint }) => ({ key, label, hint }))}
        engines={ENGINES.map((e) => ({ id: e.id, label: e.label, href: e.href, ready: ready[e.id] }))}
      />
    </div>
  );
}
