"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { LoadingBar } from "@/components/loading-bar";
import { CHANNEL_COLORS, CHANNEL_LABELS } from "@/lib/chat/channels";
import type { ChatsView } from "@/lib/chat/view";
import { clearHandoff, linkCompany, setConversationAi } from "./actions";
import { Composer } from "./composer";
import { Messages } from "./messages";

// Новые сообщения и «печатает…» подтягиваются раз в 2 секунды без перерисовки всей страницы:
// если сервер не ответил, на экране остаётся то, что было, и следующий опрос пробует снова
function useLiveView(initial: ChatsView) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [shown, setShown] = useState(initial);
  // Переписка, которая открывается прямо сейчас: её данные ещё в пути
  const [opening, setOpening] = useState<string | null>(null);
  if (shown !== initial) {
    // Страница пришла заново: своё действие (отправка, AI, привязка) или переход «назад» в браузере
    setShown(initial);
    setView(initial);
    setOpening(null);
  }
  const latest = useRef({ view, opening });
  latest.current = { view, opening };
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
  }, [initial]);

  useEffect(() => {
    let busy = false;
    const id = setInterval(async () => {
      if (busy || latest.current.opening || document.visibilityState !== "visible") return;
      busy = true;
      const gen = generation.current;
      const { version, current } = latest.current.view;
      try {
        const r = await fetch(`/api/chats/view?c=${current?.id ?? ""}&v=${version}`, { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { view?: ChatsView };
        // Пока ждали ответ, страница могла смениться: старые данные поверх новых не кладём
        const now = latest.current;
        if (data.view && gen === generation.current && !now.opening && data.view.current?.id === now.view.current?.id) setView(data.view);
      } catch {
        // Сервер занят или пропала сеть: попробуем на следующем шаге
      } finally {
        busy = false;
      }
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Переписка открывается без перезагрузки страницы: адрес меняется сразу, данные подтягиваются
  // отдельным запросом, а пока они идут, справа бежит полоса загрузки
  async function open(id: string | null) {
    const url = id ? `/chats?c=${id}` : "/chats";
    window.history.pushState(null, "", url);
    if (!id) {
      setOpening(null);
      setView((v) => ({ ...v, current: null }));
      return;
    }
    setOpening(id);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`/api/chats/view?c=${id}`, { cache: "no-store" });
        const data = r.ok ? ((await r.json()) as { view?: ChatsView }) : null;
        if (latest.current.opening !== id) return;
        if (data?.view) {
          setView(data.view);
          setOpening(null);
          return;
        }
      } catch {}
      await new Promise((ok) => setTimeout(ok, 1000));
      if (latest.current.opening !== id) return;
    }
    // Сервер так и не ответил: открываем переписку обычным переходом
    router.push(url);
  }

  return { view, opening, open };
}

// Обычный щелчок открывает переписку на месте; с Cmd или Ctrl — как обычная ссылка, в новой вкладке
function openHere(e: React.MouseEvent, run: () => void) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  run();
}

export function ChatsLive({ initial, companies }: { initial: ChatsView; companies: { id: string; name: string }[] }) {
  const { view, opening, open } = useLiveView(initial);
  const { list, current, agentName, aiReady, connected } = view;
  const selected = opening ?? current?.id;

  return (
    <div className="grid h-[calc(100dvh-15rem)] min-h-[300px] md:min-h-[420px] grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-card md:h-[calc(100dvh-12.5rem)] md:grid-cols-[320px_minmax(0,1fr)]">
      <aside className={`flex-col overflow-y-auto border-slate-100 md:flex md:border-r ${selected ? "hidden" : "flex"}`}>
        {list.length === 0 ? (
          <p className="m-auto max-w-60 p-6 text-center text-sm text-slate-500">
            {connected
              ? "Пока никто не написал. Сообщения клиентов появятся здесь."
              : "Подключите Telegram, Max или VK в «Интеграциях», и сообщения клиентов появятся здесь."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/chats?c=${x.id}`}
                  prefetch={false}
                  onClick={(e) => openHere(e, () => open(x.id))}
                  aria-current={x.id === selected ? "page" : undefined}
                  className={`flex items-center gap-3 px-4 py-3 ${x.id === selected ? "bg-blue-50" : "hover:bg-slate-50"}`}
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
                      <span className="shrink-0 text-xs text-slate-400">{x.time}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      {x.typing ? (
                        <span className="truncate text-sm text-blue-600">{agentName ?? "AI"} печатает…</span>
                      ) : (
                        <span className="truncate text-sm text-slate-500">{x.preview}</span>
                      )}
                      {x.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                          {x.unread}
                        </span>
                      )}
                    </span>
                    {x.company && <span className="block truncate text-xs text-blue-700">{x.company}</span>}
                    {x.handoff ? (
                      <span className="block truncate text-xs font-medium text-amber-700">AI передал вам: нужен менеджер</span>
                    ) : (
                      x.ai && <span className="block text-xs text-slate-400">Отвечает AI</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {opening ? (
        <section className="flex min-h-0 min-w-0 flex-col">
          <LoadingBar className="flex-1" />
        </section>
      ) : current ? (
        <section className="flex min-h-0 min-w-0 flex-col">
          <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-5">
            <Link
              href="/chats"
              onClick={(e) => openHere(e, () => open(null))}
              aria-label="Все чаты"
              className="-ml-1 rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden"
            >
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
            {agentName && (
              <form action={setConversationAi.bind(null, current.id, !current.ai)}>
                <button
                  type="submit"
                  role="switch"
                  aria-checked={current.ai}
                  title={current.ai ? "AI отвечает в этой переписке. Нажмите, чтобы выключить" : "Включить AI в этой переписке"}
                  className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-sm ${
                    current.ai ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className={`relative h-4 w-7 rounded-full transition-colors ${current.ai ? "bg-blue-600" : "bg-slate-300"}`}>
                    <span
                      className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${current.ai ? "left-3.5" : "left-0.5"}`}
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
          {(current.handoff !== null || current.aiError) && (
            <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:px-5">
              <p className="min-w-0 flex-1">
                {current.handoff !== null ? `AI передал переписку вам: ${current.handoff}` : `AI не ответил: ${current.aiError}`}
              </p>
              <form action={clearHandoff.bind(null, current.id)}>
                <button type="submit" className="shrink-0 text-xs font-medium underline">
                  Понятно
                </button>
              </form>
            </div>
          )}
          <Messages messages={current.messages} typing={current.typing ? (agentName ?? "AI агент") : null} />
          <Composer key={current.id} conversationId={current.id} aiDraft={aiReady} disabled={current.disabled} />
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
  );
}
