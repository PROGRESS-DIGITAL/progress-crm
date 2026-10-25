import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { db } from "@/lib/db";
import { CHANNEL_COLORS, CHANNEL_LABELS } from "@/lib/chat/channels";
import { connectedChannels } from "@/lib/chat/send";
import { formatChatTime } from "@/lib/format";
import { linkCompany } from "./actions";
import { AutoRefresh } from "./auto-refresh";
import { Composer } from "./composer";
import { Messages } from "./messages";

export const dynamic = "force-dynamic";

const MESSAGES_SHOWN = 300;

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const [conversations, connected] = await Promise.all([
    db.conversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      include: { company: { select: { name: true } } },
    }),
    connectedChannels(),
  ]);

  const current = c ? conversations.find((x) => x.id === c) : undefined;
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
          <p className="mt-1 text-sm text-slate-600">Переписка с клиентами из мессенджеров</p>
        </div>
        <Link
          href="/integrations"
          className={
            connected.size
              ? "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              : "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
          }
        >
          {connected.size
            ? `Подключено: ${[...connected].map((ch) => CHANNEL_LABELS[ch]).join(", ")}`
            : "Подключить мессенджер"}
        </Link>
      </div>

      <div className="grid h-[calc(100dvh-15rem)] min-h-[420px] grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-card md:h-[calc(100dvh-12.5rem)] md:grid-cols-[320px_minmax(0,1fr)]">
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
