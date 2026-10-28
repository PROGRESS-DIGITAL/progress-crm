import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { db } from "@/lib/db";
import { CHANNEL_COLORS, CHANNEL_LABELS } from "@/lib/chat/channels";
import { connectedChannels } from "@/lib/chat/send";
import { formatChatTime } from "@/lib/format";
import { aiOn, getChatAi } from "@/lib/agents/client-chat";
import { getSetting } from "@/lib/settings";
import { getRemindChat } from "@/lib/reminders";
import { CLAUDE_KEY_SETTING } from "@/lib/agents/agent";
import { clearHandoff, linkCompany, saveChatAi, setConversationAi } from "./actions";
import { AutoRefresh } from "./auto-refresh";
import { Composer } from "./composer";
import { Messages } from "./messages";

export const dynamic = "force-dynamic";

const MESSAGES_SHOWN = 300;

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const [conversations, connected, ai, agents, claudeKey, remind] = await Promise.all([
    db.conversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      include: { company: { select: { name: true } } },
    }),
    connectedChannels(),
    getChatAi(),
    db.agent.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true, name: true } }),
    getSetting(CLAUDE_KEY_SETTING),
    getRemindChat(),
  ]);
  const aiAgent = agents.find((a) => a.id === ai.agentId) ?? null;
  const aiReady = !!aiAgent && !!claudeKey;

  const current = c ? conversations.find((x) => x.id === c) : undefined;
  const currentAi = !!current && aiOn(current, ai, remind?.chatId);
  const [messages, companies] = current
    ? await Promise.all([
        db.chatMessage.findMany({
          where: { conversationId: current.id },
          orderBy: { createdAt: "desc" },
          take: MESSAGES_SHOWN,
        }),
        db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ])
    : [[], []];
  // Открытая переписка считается прочитанной
  if (current?.unread) {
    await db.conversation.update({ where: { id: current.id }, data: { unread: 0 } });
    current.unread = 0;
  }

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <AutoRefresh />
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
                выключается в ней.
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

      <div className="grid h-[calc(100dvh-15rem)] min-h-[300px] md:min-h-[420px] grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-card md:h-[calc(100dvh-12.5rem)] md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`flex-col overflow-y-auto border-slate-100 md:flex md:border-r ${current ? "hidden" : "flex"}`}>
          {conversations.length === 0 ? (
            <p className="m-auto max-w-60 p-6 text-center text-sm text-slate-500">
              {connected.size
                ? "Пока никто не написал. Сообщения клиентов появятся здесь."
                : "Подключите Telegram, Max или VK в «Интеграциях», и сообщения клиентов появятся здесь."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.map((x) => (
                <li key={x.id}>
                  <Link
                    href={`/chats?c=${x.id}`}
                    aria-current={x.id === current?.id ? "page" : undefined}
                    className={`flex items-center gap-3 px-4 py-3 ${x.id === current?.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
                  >
                    <span className="relative">
                      <Avatar name={x.name} size={44} />
                      <span
                        title={CHANNEL_LABELS[x.channel]}
                        className={`absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full ring-2 ring-white ${CHANNEL_COLORS[x.channel]}`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{x.name}</span>
                        <span className="shrink-0 text-xs text-slate-400">{formatChatTime(x.lastMessageAt)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-slate-500">{x.lastText ?? "—"}</span>
                        {x.unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                            {x.unread}
                          </span>
                        )}
                      </span>
                      {x.company && <span className="block truncate text-xs text-blue-700">{x.company.name}</span>}
                      {x.aiHandoffAt ? (
                        <span className="block truncate text-xs font-medium text-amber-700">AI передал вам: нужен менеджер</span>
                      ) : (
                        aiOn(x, ai, remind?.chatId) && <span className="block text-xs text-slate-400">Отвечает AI</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {current ? (
          <section className="flex min-h-0 min-w-0 flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-5">
              <Link href="/chats" aria-label="Все чаты" className="-ml-1 rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden">
                <Icon name="back" />
              </Link>
              <Avatar name={current.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{current.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {CHANNEL_LABELS[current.channel]}
                  {current.username && ` · @${current.username}`}
                </p>
              </div>
              {aiAgent && (
                <form action={setConversationAi.bind(null, current.id, !currentAi)}>
                  <button
                    type="submit"
                    role="switch"
                    aria-checked={currentAi}
                    title={currentAi ? "AI отвечает в этой переписке. Нажмите, чтобы выключить" : "Включить AI в этой переписке"}
                    className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-sm ${
                      currentAi ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`relative h-4 w-7 rounded-full transition-colors ${currentAi ? "bg-blue-600" : "bg-slate-300"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${currentAi ? "left-3.5" : "left-0.5"}`}
                      />
                    </span>
                    AI
                  </button>
                </form>
              )}
              <form key={current.companyId ?? ""} action={linkCompany.bind(null, current.id)} className="flex w-full items-center gap-2 sm:w-auto">
                <select
                  name="companyId"
                  defaultValue={current.companyId ?? ""}
                  aria-label="Клиент"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white pl-3 text-sm sm:w-56 sm:flex-none"
                >
                  <option value="">Не привязан к клиенту</option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>
                      {co.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="h-9 rounded-xl border border-slate-200 px-3 text-sm hover:bg-slate-50">
                  Привязать
                </button>
                {current.companyId && (
                  <Link href={`/clients/${current.companyId}`} className="text-sm whitespace-nowrap text-blue-700 hover:underline">
                    Карточка
                  </Link>
                )}
              </form>
            </header>
            {(current.aiHandoffAt || current.aiError) && (
              <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:px-5">
                <p className="min-w-0 flex-1">
                  {current.aiHandoffAt ? `AI передал переписку вам: ${current.aiHandoff}` : `AI не ответил: ${current.aiError}`}
                </p>
                <form action={clearHandoff.bind(null, current.id)}>
                  <button type="submit" className="shrink-0 text-xs font-medium underline">
                    Понятно
                  </button>
                </form>
              </div>
            )}
            <Messages
              messages={messages.reverse().map((m) => ({
                id: m.id,
                direction: m.direction,
                text: m.text,
                author: m.author,
                time: formatChatTime(m.createdAt),
              }))}
            />
            <Composer
              conversationId={current.id}
              aiDraft={aiReady}
              disabled={
                connected.has(current.channel)
                  ? undefined
                  : `${CHANNEL_LABELS[current.channel]} не подключён: подключите его в «Интеграциях»`
              }
            />
          </section>
        ) : (
          <div className="hidden items-center justify-center text-sm text-slate-500 md:flex">
            <span className="flex flex-col items-center gap-2">
              <Icon name="chat" size={32} className="text-slate-300" />
              Выберите переписку слева
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
