import Link from "next/link";
import { db } from "@/lib/db";

const mailDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });

/**
 * Блок «Письма»: последние письма с адресов клиента и кнопка «+ Написать».
 * Используется в карточке клиента и в карточке сделки.
 * `to` — адрес, который подставится в окно нового письма.
 */
export async function ClientMails({ companyId, to }: { companyId: string; to?: string | null }) {
  const [mails, mailboxes] = await Promise.all([
    db.mailMessage.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      take: 10,
      select: { id: true, folder: true, subject: true, fromEmail: true, fromName: true, to: true, date: true, seen: true },
    }),
    db.mailAccount.count(),
  ]);
  if (mailboxes === 0 && mails.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Письма</h2>
        {mailboxes > 0 && (
          <Link href={`/mail/new${to ? `?to=${encodeURIComponent(to)}` : ""}`} className="text-sm font-medium text-blue-600 hover:underline">
            + Написать
          </Link>
        )}
      </div>
      {mails.length === 0 ? (
        <p className="text-sm text-slate-500">Писем с адресов клиента пока нет</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {mails.map((m) => (
            <li key={m.id}>
              <Link
                href={`/mail?f=${m.folder === "SENT" ? "sent" : "inbox"}&m=${m.id}`}
                className="flex items-center gap-3 py-3 text-sm hover:text-blue-700"
              >
                <span className="w-24 shrink-0 text-xs text-slate-500">{m.folder === "SENT" ? "Отправлено" : "Входящее"}</span>
                <span className={`min-w-0 flex-1 truncate ${!m.seen ? "font-semibold" : ""}`}>
                  {m.subject}
                  <span className="font-normal text-slate-500"> · {m.folder === "SENT" ? m.to : m.fromName || m.fromEmail}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">{mailDate.format(m.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
