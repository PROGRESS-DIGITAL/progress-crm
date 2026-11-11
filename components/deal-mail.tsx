import Link from "next/link";
import { Icon } from "@/components/icons";

// «Написать клиенту» в сделке: открывает раздел Почта с новым письмом, где адрес клиента уже стоит в «Кому»
export function DealMail({ to }: { to: string | null }) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Написать клиенту</h2>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {to ?? "Почта клиента не указана: адрес можно будет ввести в письме"}
          </p>
        </div>
        <Link
          href={`/mail/new${to ? `?to=${encodeURIComponent(to)}` : ""}`}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          <Icon name="mail" size={16} />
          Написать письмо
        </Link>
      </div>
    </section>
  );
}
