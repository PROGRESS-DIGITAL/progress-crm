import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { TRASH_DAYS, visibleTo } from "@/lib/activity";
import { TRASH_KINDS, trashWording, type TrashKind } from "@/lib/trash";
import { formatDateTime } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { deleteForever, restoreItem } from "./actions";

export const dynamic = "force-dynamic";

function daysLeft(deletedAt: Date, now: number) {
  const left = Math.ceil((deletedAt.getTime() + TRASH_DAYS * 86_400_000 - now) / 86_400_000);
  if (left <= 1) return "удалится завтра";
  const word = left % 10 === 1 && left % 100 !== 11 ? "день" : [2, 3, 4].includes(left % 10) && ![12, 13, 14].includes(left % 100) ? "дня" : "дней";
  return `удалится через ${left} ${word}`;
}

// Корзина: удалённые сделки, клиенты, контакты, встречи, задачи, счета, договоры и услуги
export default async function TrashPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;
  const items = await db.trashItem.findMany({
    where: visibleTo(user),
    orderBy: { deletedAt: "desc" },
    select: { id: true, kind: true, section: true, title: true, deletedAt: true, deletedBy: true },
  });
  const now = Date.now();

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href="/activity" className="text-sm text-slate-500 hover:text-slate-800">
        ← Журнал событий
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Корзина</h1>
      <p className="mt-1 mb-4 text-sm text-slate-600">
        Удалённое хранится здесь {TRASH_DAYS} дней, потом удаляется насовсем. Восстановленная запись возвращается со своими связями.
      </p>
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">Не получилось восстановить: {error}</p>}
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Корзина пуста</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-card">
          {items.map((t) => {
            const kind = t.kind in TRASH_KINDS ? trashWording(t.kind as TrashKind, t.section) : null;
            return (
              <li key={t.id} id={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 target:bg-amber-50">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-xs text-slate-500">{kind?.label ?? t.kind}</p>
                  <p className="truncate font-medium text-slate-900">{t.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Удалено {formatDateTime(t.deletedAt)}
                    {t.deletedBy && ` · ${t.deletedBy}`} · {daysLeft(t.deletedAt, now)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <form action={restoreItem.bind(null, t.id)}>
                    <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                      Восстановить
                    </button>
                  </form>
                  <ConfirmDeleteButton
                    action={deleteForever.bind(null, t.id)}
                    what={`«${t.title}» навсегда`}
                    message="Из корзины запись удаляется без возможности восстановить."
                    label="Удалить навсегда"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
