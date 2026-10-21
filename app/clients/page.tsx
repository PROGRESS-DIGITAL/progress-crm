import Link from "next/link";
import { db } from "@/lib/db";
import { formatRub } from "@/lib/format";
import { inputClass } from "@/components/field";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? "";
  const companies = await db.company.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { inn: { contains: q } },
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
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Клиенты</h1>
          <p className="mt-1 text-sm text-slate-600">Всего: {companies.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <form className="w-72">
            <input
              name="q"
              defaultValue={q}
              placeholder="Поиск по названию, ИНН, контакту"
              className={inputClass}
            />
          </form>
          <Link
            href="/clients/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Компания</th>
                <th className="px-4 py-3 font-medium">ИНН</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
                <th className="px-4 py-3 text-right font-medium">Контакты</th>
                <th className="px-4 py-3 text-right font-medium">В работе</th>
                <th className="px-4 py-3 text-right font-medium">Выиграно</th>
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
      )}
    </div>
  );
}
