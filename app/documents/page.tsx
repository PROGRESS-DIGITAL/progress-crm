import Link from "next/link";
import { db } from "@/lib/db";
import { ensureDefaultTemplate, getExecutor } from "@/lib/contracts/store";
import { shortDate } from "@/lib/contracts/fields";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { deleteContractFromList } from "./actions";
import { NewTemplateForm } from "./new-template-form";
import { ExecutorForm } from "./executor-form";

export const dynamic = "force-dynamic";

const TABS = [
  { tab: "contracts", label: "Договоры" },
  { tab: "templates", label: "Шаблоны" },
  { tab: "requisites", label: "Мои реквизиты" },
] as const;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const t = (await searchParams).tab;
  const tab = t === "templates" || t === "requisites" ? t : "contracts";
  await ensureDefaultTemplate();
  const executor = await getExecutor();

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Документы</h1>
          <p className="mt-1 text-sm text-slate-600">Договоры создаются из карточки сделки по шаблону</p>
        </div>
        <nav className="flex max-w-full overflow-x-auto rounded-xl bg-white p-1 text-sm shadow-card" aria-label="Раздел документов">
          {TABS.map((x) => (
            <Link
              key={x.tab}
              href={x.tab === "contracts" ? "/documents" : `/documents?tab=${x.tab}`}
              aria-current={tab === x.tab ? "page" : undefined}
              className={`rounded-lg px-4 py-1.5 whitespace-nowrap ${tab === x.tab ? "bg-blue-600 font-medium text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {x.label}
            </Link>
          ))}
        </nav>
      </div>
      {!executor && tab !== "requisites" && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Заполните{" "}
          <Link href="/documents?tab=requisites" className="font-medium underline">
            свои реквизиты
          </Link>
          : они подставляются в договор за исполнителя.
        </p>
      )}
      {tab === "contracts" && <Contracts />}
      {tab === "templates" && <Templates />}
      {tab === "requisites" && (
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-semibold">Реквизиты исполнителя</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500">Подставляются в каждый договор: шапка, преамбула, реквизиты и подпись.</p>
          <ExecutorForm initial={executor} />
        </section>
      )}
    </div>
  );
}

async function Contracts() {
  const contracts = await db.contract.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { company: { select: { id: true, name: true } }, deal: { select: { id: true, title: true } } },
    take: 300,
  });
  if (!contracts.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Договоров пока нет. Откройте сделку и нажмите «Создать договор».
      </p>
    );
  }
  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Договор</th>
            <th className="px-4 py-3 font-medium">Клиент</th>
            <th className="px-4 py-3 font-medium">Сделка</th>
            <th className="px-4 py-3 font-medium">Шаблон</th>
            <th className="w-12 px-2 py-3">
              <span className="sr-only">Удалить</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {contracts.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/documents/contracts/${c.id}`} className="font-medium text-blue-700 hover:underline">
                  № {c.number} от {shortDate(c.date)}
                </Link>
              </td>
              <td className="px-4 py-3">
                {c.company ? (
                  <Link href={`/clients/${c.company.id}`} className="hover:underline">
                    {c.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {c.deal ? (
                  <Link href={`/deals/${c.deal.id}`} className="hover:underline">
                    {c.deal.title}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{c.title}</td>
              <td className="px-2 py-1.5">
                <ConfirmDeleteButton
                  icon
                  action={deleteContractFromList.bind(null, c.id)}
                  label={`Удалить договор № ${c.number}`}
                  what={`договор № ${c.number} от ${shortDate(c.date)}`}
                  message="Это действие нельзя отменить."
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function Templates() {
  const templates = await db.contractTemplate.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contracts: true } } },
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="rounded-2xl border border-slate-200/60 bg-white shadow-card">
        {templates.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Шаблонов нет. Загрузите договор в формате .docx.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <Link href={`/documents/templates/${t.id}`} className="font-medium text-blue-700 hover:underline">
                  {t.name}
                </Link>
                <span className="text-sm text-slate-500">
                  {t._count.contracts ? `договоров: ${t._count.contracts}` : "договоров пока нет"} · изменён {shortDate(t.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <h2 className="font-semibold">Новый шаблон</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Загрузите договор из Word или начните с пустого листа. Данные клиента и сделки замените полями через «Вставить поле».
        </p>
        <NewTemplateForm />
      </section>
    </div>
  );
}
