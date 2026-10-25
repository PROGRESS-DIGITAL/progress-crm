import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SERVICE_LABELS, formatRub } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { createContact, deleteCompany, deleteContact, updateCompany } from "../actions";
import { CompanyForm } from "../company-form";
import { ContactForm } from "../contact-form";
import { SalesPlan } from "../sales-plan";
import { getClientPlan, getStepProducts } from "@/lib/sales-map-data";

export const dynamic = "force-dynamic";

const KIND_BADGE = {
  OPEN: "bg-blue-50 text-blue-700",
  WON: "bg-emerald-50 text-emerald-700",
  LOST: "bg-rose-50 text-rose-700",
} as const;

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; merged?: string }>;
}) {
  const [{ id }, { error, merged }] = await Promise.all([params, searchParams]);
  const company = await db.company.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { fullName: "asc" } },
      deals: {
        orderBy: { createdAt: "desc" },
        include: { stage: { select: { name: true, kind: true } }, contact: { select: { fullName: true } } },
      },
    },
  });
  if (!company) notFound();
  const [plan, stepProducts] = await Promise.all([getClientPlan(company.id, company.situation), getStepProducts()]);

  return (
    <div className="mx-auto w-full max-w-7xl px-1 py-4 sm:px-3 sm:py-5">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-800">
            ← Клиенты
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{company.name}</h1>
        </div>
        <ConfirmDeleteButton
          action={deleteCompany.bind(null, company.id)}
          message="Удалить клиента вместе с контактами?"
        />
      </div>
      {merged && (
        <p className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Клиенты объединены. Проверьте реквизиты: заполненные поля остались прежними, пустые дополнены.
        </p>
      )}
      {error === "has-deals" && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          У клиента есть сделки. Удалите или перенесите их, прежде чем удалять клиента.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Реквизиты</h2>
          <CompanyForm
            action={updateCompany.bind(null, company.id)}
            initial={company}
            submitLabel="Сохранить"
            mode="edit"
          />
        </section>

        <section className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Контакты · {company.contacts.length}</h2>
          {company.contacts.length > 0 && (
            <ul className="mb-6 divide-y divide-slate-100">
              {company.contacts.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="text-sm">
                    <Link
                      href={`/clients/${company.id}/contacts/${c.id}`}
                      className="font-medium hover:text-blue-700"
                    >
                      {c.fullName}
                    </Link>
                    {c.position && <span className="text-slate-500"> · {c.position}</span>}
                    <div className="mt-0.5 text-slate-600">
                      {[c.phone, c.email].filter(Boolean).join(" · ") || "Нет телефона и email"}
                    </div>
                  </div>
                  <ConfirmDeleteButton
                    action={deleteContact.bind(null, c.id)}
                    message={`Удалить контакт «${c.fullName}»?`}
                  />
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Добавить контакт</h3>
          <ContactForm action={createContact.bind(null, company.id)} submitLabel="Добавить" />
        </section>
      </div>

      <SalesPlan companyId={company.id} plan={plan} manual={company.situation} products={stepProducts} />

      <section className="mt-6 rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Сделки · {company.deals.length}</h2>
          <Link href={`/deals/new?companyId=${company.id}`} className="text-sm font-medium text-blue-600 hover:underline">
            + Новая сделка
          </Link>
        </div>
        {company.deals.length === 0 ? (
          <p className="text-sm text-slate-500">Сделок пока нет</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {company.deals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <Link href={`/deals/${d.id}`} className="font-medium hover:text-blue-700">
                    {d.title}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    · {SERVICE_LABELS[d.service]}
                    {d.contact && ` · ${d.contact.fullName}`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${KIND_BADGE[d.stage.kind]}`}>{d.stage.name}</span>
                  <span className="font-semibold tabular-nums">{formatRub(d.amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
