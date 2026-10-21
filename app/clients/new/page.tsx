import { createCompany } from "../actions";
import { CompanyForm } from "../company-form";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новый клиент</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <CompanyForm action={createCompany} submitLabel="Создать клиента" />
      </div>
    </div>
  );
}
