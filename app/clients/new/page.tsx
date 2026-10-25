import { createCompany } from "../actions";
import { CompanyForm } from "../company-form";

export default function NewClientPage() {
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новый клиент</h1>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
        <CompanyForm action={createCompany} submitLabel="Создать клиента" />
      </div>
    </div>
  );
}
