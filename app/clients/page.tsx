import Link from "next/link";
import { db } from "@/lib/db";
import { formatRub } from "@/lib/format";
import { ClientSearch } from "./client-search";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? "";
  const companies = await db.company.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { inn: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
            { contacts: { some: { fullName: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { contacts: true } },
      deals: { select: { amount: true, stage: { select: { kind: true } } } },
    },
  });

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Клиенты</h1>
          <p className="mt-1 text-sm text-slate-600">Всего: {companies.length}</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <ClientSearch initial={q} />
          <Link
            href="/clients/new"
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
          >
            + Новый клиент
          </Link>
        </div>
      </div>

      {companies.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {q ? "Ничего не найдено" : "Клиентов пока нет"}
        </p>
      ) : (
        <>
        {/* На телефоне таблица не помещается: клиенты идут карточками, телефон звонит по нажатию */}
        <ul className="flex flex-col gap-2 sm:hidden">
          {companies.map((c) => {
            const open = c.deals.filter((d) => d.stage.kind === "OPEN");
            const won = c.deals.filter((d) => d.stage.kind === "WON").reduce((a, d) => a + d.amount, 0);
            return (
              <li key={c.id} className="relative rounded-2xl bg-white p-4 shadow-card">
                <Link href={`/clients/${c.id}`} className="block font-medium text-slate-900 after:absolute after:inset-0">
                  {c.name}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                  {[c.inn && `ИНН ${c.inn}`, c._count.contacts > 0 && `контактов: ${c._count.contacts}`].filter(Boolean).join(" · ") || "Без ИНН"}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                  {c.phone ? (
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="relative z-10 text-blue-600">
                      {c.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">Нет телефона</span>
                  )}
                  <span className="text-slate-600 tabular-nums">
                    {open.length > 0 ? `В работе ${open.length} · ${formatRub(open.reduce((a, d) => a + d.amount, 0))}` : won > 0 ? `Оплачено ${formatRub(won)}` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="relative hidden overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-card sm:block">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Компания</th>
                <th className="px-4 py-3 font-medium">ИНН</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
                <th className="px-4 py-3 text-right font-medium">Контакты</th>
                <th className="px-4 py-3 text-right font-medium">В работе</th>
                <th className="px-4 py-3 text-right font-medium">Оплачено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => {
                const open = c.deals.filter((d) => d.stage.kind === "OPEN");
                const won = c.deals.filter((d) => d.stage.kind === "WON").reduce((a, d) => a + d.amount, 0);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{c.inn ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c._count.contacts}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {open.length > 0 ? `${open.length} · ${formatRub(open.reduce((a, d) => a + d.amount, 0))}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{won > 0 ? formatRub(won) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
