import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { formatChatTime } from "@/lib/format";
import { monthLabel, monthKey } from "@/lib/monthly";
import { CLAUDE_KEY_SETTING, ensureDefaultAgent } from "@/lib/agents/agent";
import { deleteAgentChat } from "../actions";
import { AgentSwitcher } from "../agent-switcher";
import { ChatPanel } from "./chat-panel";

export const dynamic = "force-dynamic";

const CHATS_SHOWN = 50;

// Подсказки для пустого чата: по разделам, которые открыты агенту
function suggestions(scopes: string[]) {
  const month = monthLabel(monthKey(new Date())).split(" ")[0].toLowerCase();
  const all: [string, string][] = [
    ["money", `Сколько выручка за ${month} на сегодня?`],
    ["sales", "Какие сделки зависли больше двух недель?"],
    ["money", "Какие счета ещё не оплачены?"],
    ["edit", "Поставь задачу на завтра в 11:00: позвонить новому клиенту"],
    ["plan", "Насколько мы отстаём от финмодели в этом месяце?"],
    ["clients", "Кто топ-5 клиентов по LTV?"],
    ["work", "Какие задачи просрочены?"],
    ["sales", "Сколько заявок пришло в этом месяце и откуда?"],
    ["comms", "Что последнее писали клиенты?"],
  ];
  return all
    .filter(([s]) => scopes.includes(s))
    .map(([, q]) => q)
    .slice(0, 4);
}

export default async function AgentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ chat?: string }> }) {
  const [{ id }, { chat: chatId }] = await Promise.all([params, searchParams]);
  await ensureDefaultAgent();
  const [agents, agent, key] = await Promise.all([
    db.agent.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true, name: true, description: true } }),
    db.agent.findUnique({ where: { id }, include: { chats: { orderBy: { updatedAt: "desc" }, take: CHATS_SHOWN } } }),
    getSetting(CLAUDE_KEY_SETTING),
  ]);
  if (!agent) notFound();
  const current = chatId ? agent.chats.find((c) => c.id === chatId) : undefined;
  const messages = current
    ? await db.agentMessage.findMany({
        where: { chatId: current.id, text: { not: null } },
        orderBy: { seq: "asc" },
        select: { id: true, role: true, text: true, sources: true, createdAt: true },
      })
    : [];

  const chatLink = (c: { id: string; title: string; updatedAt: Date }) => (
    <Link
      href={`/agents/${agent.id}?chat=${c.id}`}
      aria-current={c.id === current?.id ? "page" : undefined}
      className={`flex items-baseline justify-between gap-2 rounded-xl px-3 py-2 text-sm ${c.id === current?.id ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}
    >
      <span className="truncate">{c.title}</span>
      <span className="shrink-0 text-xs text-slate-400">{formatChatTime(c.updatedAt)}</span>
    </Link>
  );

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4 sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI агенты</h1>
          <p className="mt-1 hidden text-sm text-slate-600 sm:block">Помощники, которые знают цифры CRM, отвечают на вопросы и заводят карточки</p>
        </div>
        <Link
          href="/agents/new"
          className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 sm:px-4"
        >
          + Новый агент
        </Link>
      </div>

      <div className="grid h-[calc(100dvh-14rem)] min-h-[400px] grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-card md:h-[calc(100dvh-12.5rem)] md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col gap-5 overflow-y-auto border-r border-slate-100 p-3 md:flex">
          <div>
            <p className="mb-2 px-3 text-xs font-medium text-slate-400">Агенты</p>
            <ul className="flex flex-col gap-1">
              {agents.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/agents/${a.id}`}
                    aria-current={a.id === agent.id ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${a.id === agent.id ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30" : "hover:bg-slate-50"}`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.id === agent.id ? "bg-white/20" : "bg-blue-50 text-blue-600"}`}
                    >
                      <Icon name="spark" size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{a.name}</span>
                      {a.description && (
                        <span className={`block truncate text-xs ${a.id === agent.id ? "text-blue-100" : "text-slate-500"}`}>{a.description}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between px-3">
              <p className="text-xs font-medium text-slate-400">История</p>
              <Link href={`/agents/${agent.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                Новый чат
              </Link>
            </div>
            {agent.chats.length ? (
              <ul className="flex flex-col gap-0.5">
                {agent.chats.map((c) => (
                  <li key={c.id}>{chatLink(c)}</li>
                ))}
              </ul>
            ) : (
              <p className="px-3 text-sm text-slate-500">Вопросов пока не было</p>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="md:hidden">
                <AgentSwitcher agents={agents.map((a) => ({ id: a.id, name: a.name }))} current={agent.id} />
              </div>
              <p className="hidden truncate font-semibold md:block">{current?.title ?? agent.name}</p>
              <p className="hidden truncate text-xs text-slate-500 md:block">
                {current ? agent.name : (agent.description ?? "Задайте вопрос по данным CRM")}
              </p>
            </div>
            {/* На телефоне новый чат и удаление спрятаны в «Историю», чтобы шапка помещалась в одну строку */}
            {agent.chats.length > 0 && (
              <details className="relative md:hidden">
                <summary className="flex h-9 cursor-pointer list-none items-center rounded-xl border border-slate-200 px-3 text-sm">История</summary>
                <div className="absolute right-0 z-20 mt-1 max-h-80 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  {current && (
                    <Link
                      href={`/agents/${agent.id}`}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-blue-600 hover:bg-slate-50"
                    >
                      <Icon name="plus" size={16} /> Новый чат
                    </Link>
                  )}
                  {agent.chats.map((c) => (
                    <div key={c.id}>{chatLink(c)}</div>
                  ))}
                  {current && (
                    <div className="border-t border-slate-100 px-3 py-2">
                      <ConfirmDeleteButton action={deleteAgentChat.bind(null, current.id)} what={`чат «${current.title}»`} label="Удалить этот чат" />
                    </div>
                  )}
                </div>
              </details>
            )}
            {current && (
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  href={`/agents/${agent.id}`}
                  title="Новый чат"
                  aria-label="Новый чат"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <Icon name="plus" size={18} />
                </Link>
                <ConfirmDeleteButton action={deleteAgentChat.bind(null, current.id)} what={`чат «${current.title}»`} label="Удалить чат" icon />
              </div>
            )}
            <Link
              href={`/agents/${agent.id}/edit`}
              title="Настроить агента"
              aria-label="Настроить агента"
              className="flex h-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-2.5 text-sm text-slate-700 hover:bg-slate-50 sm:px-3"
            >
              <Icon name="settings" size={18} className="sm:hidden" />
              <span className="hidden sm:inline">Настроить</span>
            </Link>
          </header>
          <ChatPanel
            key={current?.id ?? "new"}
            agentId={agent.id}
            agentName={agent.name}
            chatId={current?.id ?? null}
            hasKey={!!key}
            suggestions={suggestions(agent.scopes)}
            messages={messages.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              text: m.text ?? "",
              sources: m.sources,
              time: formatChatTime(m.createdAt),
            }))}
          />
        </section>
      </div>
    </div>
  );
}
