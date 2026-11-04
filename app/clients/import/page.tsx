import Link from "next/link";
import { ImportForm } from "./import-form";

export default function ImportClientsPage() {
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-800">
        ← Клиенты
      </Link>
      <h1 className="mt-1 mb-6 text-2xl font-semibold tracking-tight">Загрузить клиентов таблицей</h1>
      <ImportForm />
    </div>
  );
}
