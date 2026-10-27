import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { db } from "@/lib/db";
import { PROVIDERS } from "@/lib/mail/core";
import { formatChatTime } from "@/lib/format";
import { disconnectMailbox } from "./actions";
import { MailboxForm } from "./mailbox-form";

export const dynamic = "force-dynamic";

export default async function MailIntegrationPage() {
  const accounts = await db.mailAccount.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href="/integrations" className="text-sm text-slate-500 hover:text-slate-800">
        ← Интеграции
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Почта</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Ящики Gmail и Яндекс Почты: письма приходят в раздел «Почта», отвечать можно прямо из CRM.
      </p>

      {accounts.length > 0 && (
        <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
          <h2 className="mb-3 font-semibold">Подключённые ящики</h2>
          <ul className="divide-y divide-slate-100">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.email}</span>
                  <span className="text-xs text-slate-500">
                    {PROVIDERS[a.provider].label}
                    {a.name && ` · от имени «${a.name}»`}
                  </span>
                </span>
                {a.lastError ? (
                  <span className="w-full text-xs text-rose-600 sm:w-auto sm:max-w-md">{a.lastError}</span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    {a.syncedAt ? `Обновлено ${formatChatTime(a.syncedAt)}` : "Забираю письма…"}
                  </span>
                )}
                <ConfirmDeleteButton
                  action={disconnectMailbox.bind(null, a.id)}
                  title={`Отключить ${a.email}?`}
                  message="Письма этого ящика удалятся из CRM. В самой почте они останутся."
                  label="Отключить"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <h2 className="mb-4 font-semibold">{accounts.length ? "Подключить ещё ящик" : "Подключить ящик"}</h2>
        <MailboxForm />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 text-sm text-slate-700 shadow-card">
          <h2 className="mb-2 font-semibold text-slate-900">Пароль приложения в Яндексе</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              В почте откройте «Все настройки» → «Почтовые программы» и включите доступ «С сервера imap.yandex.ru по протоколу IMAP».
            </li>
            <li>
              Откройте{" "}
              <a href={PROVIDERS.YANDEX.passwordUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                Яндекс ID → Пароли приложений
              </a>
              , выберите «Почта» и назовите пароль, например «CRM».
            </li>
            <li>Скопируйте показанный пароль и вставьте его выше вместе с адресом ящика.</li>
          </ol>
        </section>
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 text-sm text-slate-700 shadow-card">
          <h2 className="mb-2 font-semibold text-slate-900">Пароль приложения в Google</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>В аккаунте Google включите двухэтапную проверку: без неё пароли приложений недоступны.</li>
            <li>
              Откройте{" "}
              <a href={PROVIDERS.GMAIL.passwordUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                Пароли приложений
              </a>
              , введите название, например «CRM», и нажмите «Создать».
            </li>
            <li>Скопируйте пароль из 16 букв и вставьте его выше вместе с адресом Gmail. Пробелы можно не убирать.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
