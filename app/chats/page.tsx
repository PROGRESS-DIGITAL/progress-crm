import Link from "next/link";
import { Icon } from "@/components/icons";
import { db } from "@/lib/db";
import { CHANNEL_LABELS } from "@/lib/chat/channels";
import { connectedChannels } from "@/lib/chat/send";
import { getChatAi } from "@/lib/agents/client-chat";
import { getSetting } from "@/lib/settings";
import { CLAUDE_KEY_SETTING } from "@/lib/agents/agent";
import { loadChatsView } from "@/lib/chat/view";
import { saveChatAi } from "./actions";
import { ChatsLive } from "./live";

export const dynamic = "force-dynamic";

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const [view, connected, ai, agents, claudeKey] = await Promise.all([
    loadChatsView(c),
    connectedChannels(),
    getChatAi(),
    db.agent.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true, name: true } }),
    getSetting(CLAUDE_KEY_SETTING),
  ]);
  const aiAgent = agents.find((a) => a.id === ai.agentId) ?? null;
  const companies = view.current ? await db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Чаты</h1>
          <p className="mt-1 hidden text-sm text-slate-600 sm:block">Переписка с клиентами из мессенджеров</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <details className="relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-2 rounded-xl border px-4 py-2 text-sm ${
                aiAgent ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <Icon name="bot" size={18} />
              <span className="max-w-44 truncate">{aiAgent ? `AI: ${aiAgent.name}` : "AI агент выключен"}</span>
            </summary>
            <form
              action={saveChatAi}
              className="absolute left-0 z-30 mt-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-lg"
            >
              <p className="font-semibold">AI агент в чатах</p>
              <p className="text-xs text-slate-500">
                Отвечает клиентам в Telegram, Max и VK через 15 секунд после их последнего сообщения. Видит только прайс и заказы самого
                клиента, если переписка привязана к нему. Если клиент просит человека или вопрос сложный, агент передаёт переписку вам и
                выключается в ней. Если агенту разрешены «Изменения в CRM», он записывает заявку клиента в «Лиды».
              </p>
              <label className="flex flex-col gap-1">
                <span className="font-medium text-slate-700">Кто отвечает</span>
                <select name="agentId" defaultValue={aiAgent?.id ?? ""} className="h-10 rounded-xl border border-slate-200 bg-white px-3">
                  <option value="">Никто, AI выключен</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" name="defaultOn" defaultChecked={ai.defaultOn} className="mt-0.5 h-4 w-4 accent-blue-600" />
                <span>
                  Отвечать во всех переписках сразу
                  <span className="block text-xs text-slate-500">Иначе включайте агента в нужной переписке кнопкой «AI» в её шапке</span>
                </span>
              </label>
              {!claudeKey && (
                <p className="text-xs text-amber-800">
                  Claude не подключён:{" "}
                  <Link href="/integrations/claude" className="underline">
                    добавьте ключ
                  </Link>
                  .
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
                  Сохранить
                </button>
                {aiAgent && (
                  <Link href={`/agents/${aiAgent.id}/edit`} className="text-xs text-blue-700 hover:underline">
                    Инструкции агента
                  </Link>
                )}
              </div>
            </form>
          </details>
          <Link
            href="/integrations"
            className={
              connected.size
                ? "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                : "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
            }
          >
            {connected.size ? (
              <>
                <span className="sm:hidden">Мессенджеры</span>
                <span className="hidden sm:inline">Подключено: {[...connected].map((ch) => CHANNEL_LABELS[ch]).join(", ")}</span>
              </>
            ) : (
              "Подключить мессенджер"
            )}
          </Link>
        </div>
      </div>

      <ChatsLive initial={view} companies={companies} />
    </div>
  );
}
