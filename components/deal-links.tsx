"use client";

import { createContext, useContext } from "react";
import { LinkInputs, LinkList, LinkPicker, useLinks, type LinksState } from "@/components/links";
import type { LinkOptions, LinkRow } from "@/lib/link-types";

const field =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const label = "block text-sm font-medium text-slate-700";

// Связи сделки: список под названием и блок «Связи» ниже формы делят одно состояние
const Ctx = createContext<{ state: LinksState; options: LinkOptions; dealId: string | null } | null>(null);

// dealId — сохранённая сделка; у новой связи уходят скрытыми полями формы form
export function DealLinks({
  dealId,
  links,
  options,
  form,
  children,
}: {
  dealId: string | null;
  links: LinkRow[];
  options: LinkOptions;
  form?: string;
  children: React.ReactNode;
}) {
  const state = useLinks(dealId ? { type: "deal", id: dealId } : null, links);
  return (
    <Ctx.Provider value={{ state, options, dealId }}>
      {children}
      {!dealId && form && <LinkInputs targets={state.targets} form={form} />}
    </Ctx.Provider>
  );
}

export function DealLinkList({ className = "mt-3" }: { className?: string }) {
  const ctx = useContext(Ctx)!;
  return <LinkList links={ctx.state.links} onRemove={ctx.state.remove} className={className} />;
}

export function DealLinksCard() {
  const ctx = useContext(Ctx)!;
  return (
    <section className="mt-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
      <h2 className="font-semibold">Связи</h2>
      <div className="mt-3">
        <LinkPicker state={ctx.state} options={ctx.options} selfId={ctx.dealId} fieldClass={field} labelClass={label} grid />
      </div>
    </section>
  );
}
