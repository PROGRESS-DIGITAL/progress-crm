import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateContact } from "../../../actions";
import { ContactForm } from "../../../contact-form";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ id: string; contactId: string }> }) {
  const { id, contactId } = await params;
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: { company: { select: { name: true } } },
  });
  if (!contact || contact.companyId !== id) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl px-1 py-4 sm:px-3 sm:py-5">
      <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
        ← {contact.company.name}
      </Link>
      <h1 className="mt-1 mb-6 text-2xl font-semibold tracking-tight">{contact.fullName}</h1>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
        <ContactForm action={updateContact.bind(null, contact.id)} initial={contact} submitLabel="Сохранить" />
      </div>
    </div>
  );
}
