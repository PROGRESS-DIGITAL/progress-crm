import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete";

// Страница подключения мессенджера: статус, форма ключа и инструкция
export function ChannelPage({
  title,
  intro,
  connected,
  onDelete,
  link,
  form,
  steps,
  note,
}: {
  title: string;
  intro: string;
  connected: string | null;
  onDelete: () => Promise<void>;
  link?: { href: string; label: string } | null;
  form: React.ReactNode;
  steps: React.ReactNode[];
  note: string;
}) {
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href="/integrations" className="text-sm text-slate-500 hover:text-slate-800">
        ← Интеграции
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">{intro}</p>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-semibold">Подключение</h2>
          {connected ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{connected}</span>
              <ConfirmDeleteButton
                action={onDelete}
                message={`Отключить ${title}? Новые сообщения перестанут приходить в CRM, переписка останется.`}
                label="Отключить"
              />
            </div>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Не подключено</span>
          )}
        </div>
        {link && (
          <p className="mb-4 text-sm text-slate-700">
            Ссылка для клиентов:{" "}
            <a href={link.href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              {link.label}
            </a>
            . Её можно поставить на сайт, в подпись и в КП.
          </p>
        )}
        {form}
      </section>

      <section className="rounded-2xl border border-slate-200/60 bg-white p-5 text-sm text-slate-700 shadow-card">
        <h2 className="mb-2 font-semibold text-slate-900">Как подключить</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <p className="mt-3 text-slate-500">{note}</p>
      </section>
    </div>
  );
}
