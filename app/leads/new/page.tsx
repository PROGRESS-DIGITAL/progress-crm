import { createLead } from "../actions";
import { LeadForm } from "../lead-form";

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новый лид</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <LeadForm action={createLead} />
      </div>
    </div>
  );
}
