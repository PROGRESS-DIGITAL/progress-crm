import Link from "next/link";
import { Suspense } from "react";
import type { MailFolder, Prisma } from "@prisma/client";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { Icon } from "@/components/icons";
import { db } from "@/lib/db";
import { formatChatTime } from "@/lib/format";
import { fileSize } from "@/lib/tasks";
import { PROVIDERS } from "@/lib/mail/core";
import { markSeenOnServer } from "@/lib/mail/imap";
import { mailSyncing } from "@/lib/mail/sync";
import { AutoRefresh } from "@/app/chats/auto-refresh";
import { deleteMail, refreshMail } from "./actions";
import { MailBody } from "./mail-body";
import { MailSearch } from "./mail-search";

export const dynamic = "force-dynamic";

const PAGE = 100;

const FOLDERS: { id: MailFolder; key: string; label: string; icon: "leads" | "send" }[] = [
  { id: "INBOX", key: "inbox", label: "Входящие", icon: "leads" },
  { id: "SENT", key: "sent", label: "Отправленные", icon: "send" },
];

const fullDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

type Search = { f?: string; m?: string; q?: string; a?: string; n?: string };

export default async function MailPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const folder = FOLDERS.find((f) => f.key === sp.f) ?? FOLDERS[0];
  const q = sp.q?.trim() ?? "";
  const limit = Math.min(Number(sp.n) || PAGE, 1000);
  const accounts = await db.mailAccount.findMany({ orderBy: { createdAt: "asc" } });
  const account = accounts.find((a) => a.id === sp.a);

  const link = (patch: Partial<Search>) => {
    const next = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter((e): e is [string, string] => !!e[1]));
    return `/mail?${next}`;
  };

  if (!accounts.length) {
    return (
      <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
        <h1 className="text-2xl font-semibold tracking-tight">Почта</h1>
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Icon name="mail" size={32} className="text-slate-300" />
          <p className="max-w-md text-sm text-slate-600">
            Подключите ящик Gmail или Яндекс Почты: входящие и отправленные письма появятся здесь, а отвечать можно будет прямо из CRM.
          </p>
          <Link href="/integrations/mail" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700">
            Подключить почту
          </Link>
        </div>
      </div>
    );
  }

  const where: Prisma.MailMessageWhereInput = {
    folder: folder.id,
    ...(account && { accountId: account.id }),
    ...(q && {
      OR: [
        { subject: { contains: q, mode: "insensitive" } },
        { fromEmail: { contains: q, mode: "insensitive" } },
        { fromName: { contains: q, mode: "insensitive" } },
        { to: { contains: q, mode: "insensitive" } },
        { text: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  const [messages, total, unread, current] = await Promise.all([
    db.mailMessage.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        fromEmail: true,
        fromName: true,
        to: true,
        subject: true,
        snippet: true,
        date: true,
        seen: true,
        company: { select: { name: true } },
        _count: { select: { attachments: { where: { cid: null } } } },
      },
    }),
    db.mailMessage.count({ where }),
    db.mailMessage.count({ where: { folder: "INBOX", seen: false, ...(account && { accountId: account.id }) } }),
    sp.m
      ? db.mailMessage.findUnique({
          where: { id: sp.m },
          include: {
            account: true,
            company: { select: { id: true, name: true } },
            attachments: { where: { cid: null }, select: { id: true, name: true, size: true } },
          },
        })
      : null,
  ]);

  // Открытое письмо прочитано: в CRM сразу, в самом ящике — в фоне, не задерживая страницу
  if (current && !current.seen) {
    await db.mailMessage.update({ where: { id: current.id }, data: { seen: true } });
    if (current.uid !== null && current.folder === "INBOX") void markSeenOnServer(current.account, current.uid).catch(() => {});
  }
  const syncing = mailSyncing();
  // Пока идёт новая попытка, старую ошибку не показываем: при удаче она исчезнет сама
  const errors = syncing ? [] : accounts.filter((a) => a.lastError);
  const back = link({ m: undefined });

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      {/* Пока письма докачиваются, страница обновляется чаще, чтобы они появлялись по мере загрузки */}
      <AutoRefresh ms={syncing ? 5_000 : 30_000} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Почта</h1>
          <p className="mt-1 truncate text-sm text-slate-600">{accounts.map((a) => a.email).join(", ")}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={refreshMail}>
            <button type="submit" className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50" title="Забрать новые письма">
              <Icon name="refresh" size={16} />
              <span className="hidden sm:inline">Обновить</span>
            </button>
          </form>
          <Link
            href="/mail/new"
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
          >
            <Icon name="plus" size={16} />
            Написать
          </Link>
        </div>
      </div>

      {syncing && (
        <div role="status" className="mb-3 flex items-center gap-3 text-sm text-slate-500">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-blue-100">
            <div className="load-stripes h-full w-full rounded-full" />
          </div>
          Забираю письма из ящика…
        </div>
      )}

      {errors.map((a) => (
        <p key={a.id} className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {a.email}: {a.lastError}.{" "}
          <Link href="/integrations/mail" className="font-medium underline">
            Настройки почты
          </Link>
        </p>
      ))}

      <div className="grid h-[calc(100dvh-15rem)] min-h-[460px] grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-card md:h-[calc(100dvh-12.5rem)] md:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[200px_360px_minmax(0,1fr)]">
        <nav className="hidden flex-col gap-1 border-r border-slate-100 p-3 xl:flex" aria-label="Папки">
          {FOLDERS.map((f) => (
            <Link
              key={f.id}
              href={link({ f: f.key, m: undefined, n: undefined })}
              aria-current={f.id === folder.id ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium ${
                f.id === folder.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon name={f.icon} size={18} />
              <span className="flex-1">{f.label}</span>
              {f.id === "INBOX" && unread > 0 && <span className="text-xs font-semibold">{unread}</span>}
            </Link>
          ))}
          {accounts.length > 1 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="px-3 pb-1 text-xs text-slate-400">Ящики</p>
              {[{ id: undefined, email: "Все ящики" }, ...accounts].map((a) => (
                <Link
                  key={a.id ?? "all"}
                  href={link({ a: a.id, m: undefined })}
                  className={`block truncate rounded-lg px-3 py-1.5 text-sm ${a.id === account?.id ? "font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {a.email}
                </Link>
              ))}
            </div>
          )}
        </nav>

        <aside className={`min-h-0 flex-col border-slate-100 md:flex md:border-r ${current ? "hidden" : "flex"}`}>
          <div className="space-y-2 border-b border-slate-100 p-3">
            <div className="flex gap-1 xl:hidden">
              {FOLDERS.map((f) => (
                <Link
                  key={f.id}
                  href={link({ f: f.key, m: undefined, n: undefined })}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium ${
                    f.id === folder.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                  {f.id === "INBOX" && unread > 0 && ` · ${unread}`}
                </Link>
              ))}
            </div>
            <Suspense>
              <MailSearch key={`${folder.key}-${sp.a ?? ""}`} initial={q} />
            </Suspense>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                {q ? "Ничего не найдено" : accounts.some((a) => a.syncedAt) ? "Писем нет" : "Забираю письма из ящика…"}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {messages.map((m) => {
                  const who = folder.id === "SENT" ? `Кому: ${m.to}` : m.fromName || m.fromEmail;
                  return (
                    <li key={m.id}>
                      <Link
                        href={link({ m: m.id })}
                        aria-current={m.id === current?.id ? "page" : undefined}
                        className={`block px-4 py-3 ${m.id === current?.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
                      >
                        <span className="flex items-baseline gap-2">
                          {!m.seen && <span className="h-2 w-2 shrink-0 self-center rounded-full bg-blue-600" aria-label="Не прочитано" />}
                          <span className={`min-w-0 flex-1 truncate text-sm ${m.seen ? "text-slate-700" : "font-semibold text-slate-900"}`}>{who}</span>
                          {m._count.attachments > 0 && <Icon name="clip" size={14} className="text-slate-400" />}
                          <span className="shrink-0 text-xs text-slate-400">{formatChatTime(m.date)}</span>
                        </span>
                        <span className={`mt-0.5 block truncate text-sm ${m.seen ? "text-slate-600" : "font-medium text-slate-900"}`}>{m.subject}</span>
                        <span className="block truncate text-xs text-slate-500">{m.snippet || "—"}</span>
                        {m.company && <span className="mt-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">{m.company.name}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {total > messages.length && (
              <Link href={link({ n: String(limit + PAGE) })} className="block p-4 text-center text-sm font-medium text-blue-700 hover:underline">
                Показать ещё
              </Link>
            )}
          </div>
        </aside>

        {current ? (
          <section className="flex min-h-0 min-w-0 flex-col">
            <header className="flex items-center gap-1 border-b border-slate-100 px-3 py-2 sm:px-5">
              <Link href={back} aria-label="К списку писем" className="-ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden">
                <Icon name="back" />
              </Link>
              <Link href={`/mail/new?reply=${current.id}`} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                <Icon name="reply" size={16} />
                Ответить
              </Link>
              {current.folder === "INBOX" && (current.cc || current.to.includes(",")) && (
                <Link href={`/mail/new?reply=${current.id}&all=1`} className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 sm:flex">
                  Ответить всем
                </Link>
              )}
              <Link href={`/mail/new?fwd=${current.id}`} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                <Icon name="forward" size={16} />
                Переслать
              </Link>
              <span className="ml-auto">
                <ConfirmDeleteButton
                  action={deleteMail.bind(null, current.id, back)}
                  what={`письмо «${current.subject}»`}
                  message="Оно уйдёт в корзину ящика."
                  icon
                />
              </span>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <h2 className="text-xl font-semibold tracking-tight">{current.subject}</h2>
              <div className="mt-3 space-y-0.5 text-sm">
                <p>
                  <span className="font-medium">{current.fromName || current.fromEmail}</span>
                  {current.fromName && <span className="text-slate-500"> &lt;{current.fromEmail}&gt;</span>}
                </p>
                <p className="text-slate-500">Кому: {current.to || "—"}</p>
                {current.cc && <p className="text-slate-500">Копия: {current.cc}</p>}
                <p className="text-slate-500">
                  {fullDate.format(current.date)}
                  {accounts.length > 1 && ` · ${current.account.email} (${PROVIDERS[current.account.provider].label})`}
                </p>
                {current.company && (
                  <p>
                    Клиент:{" "}
                    <Link href={`/clients/${current.company.id}`} className="text-blue-700 hover:underline">
                      {current.company.name}
                    </Link>
                  </p>
                )}
              </div>
              {current.attachments.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {current.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={`/mail/files/${a.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex max-w-64 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <Icon name="clip" size={16} className="shrink-0 text-slate-400" />
                        <span className="truncate">{a.name}</span>
                        <span className="shrink-0 text-xs text-slate-400">{fileSize(a.size)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5">
                {current.html ? (
                  <MailBody html={current.html} />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-800">{current.text || "Письмо без текста"}</p>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="hidden items-center justify-center text-sm text-slate-500 md:flex">
            <span className="flex flex-col items-center gap-2">
              <Icon name="mail" size={32} className="text-slate-300" />
              Выберите письмо
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
