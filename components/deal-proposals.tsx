import Link from "next/link";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/format";
import { parseItems, plural, totalLines } from "@/lib/proposals/text";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { deleteProposal } from "@/app/deals/[id]/kp/actions";

// КП по сделке: собрать новое по шаблону студии, открыть PDF, поправить или удалить
export async function DealProposals({ dealId }: { dealId: string }) {
  const [proposals, template] = await Promise.all([
    db.proposal.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      select: { id: true, client: true, period: true, items: true, updatedAt: true },
    }),
    db.proposalTemplate.findUnique({ where: { id: 1 }, select: { id: true } }),
  ]);

  return (
    <section id="kp" className="mt-6 scroll-mt-20 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Коммерческое предложение</h2>
        <div className="flex items-center gap-4">
          <Link href="/price/kp" className="text-sm text-blue-600 hover:underline">
            Шаблон КП
          </Link>
          <Link
            href={`/deals/${dealId}/kp/new`}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
          >
            Собрать КП
          </Link>
        </div>
      </div>
      {!template && (
        <p className="mt-2 text-sm text-slate-500">
          Чтобы в КП попали слайды о студии и контакты,{" "}
          <Link href="/price/kp" className="text-blue-600 hover:underline">
            загрузите презентацию студии
          </Link>
          .
        </p>
      )}
      {proposals.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {proposals.map((p) => {
            const items = parseItems(p.items);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
                <div className="min-w-0 flex-1 basis-64">
                  <a
                    href={`/deals/${dealId}/kp/${p.id}/pdf`}
                    target="_blank"
                    rel="noopener"
                    className="font-medium text-blue-700 hover:underline"
                  >
                    КП · {p.client} · {p.period}
                  </a>
                  <p className="text-xs text-slate-500">
                    {items.length} {plural(items.length, "услуга", "услуги", "услуг")} · {totalLines(items).join(" ")} · изменено{" "}
                    {p.updatedAt.toLocaleDateString("ru-RU", { timeZone: TIME_ZONE })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`/deals/${dealId}/kp/${p.id}/pdf?download`} className="text-blue-600 hover:underline">
                    Скачать
                  </a>
                  <Link href={`/deals/${dealId}/kp/${p.id}`} className="text-blue-600 hover:underline">
                    Изменить
                  </Link>
                  <ConfirmDeleteButton
                    action={deleteProposal.bind(null, dealId, p.id)}
                    what={`КП «${p.client}» (${p.period})`}
                    icon
                    label="Удалить КП"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
