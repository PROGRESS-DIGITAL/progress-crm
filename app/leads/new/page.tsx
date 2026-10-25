import { createLead } from "../actions";
import { LeadForm } from "../lead-form";

export default function NewLeadPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-1 py-4 sm:px-3 sm:py-5">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новый лид</h1>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
        <LeadForm action={createLead} />
      </div>
    </div>
  );
}
