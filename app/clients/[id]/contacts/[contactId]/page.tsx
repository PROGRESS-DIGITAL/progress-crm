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
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
        ← {contact.company.name}
      </Link>
      <h1 className="mt-1 mb-6 text-2xl font-semibold tracking-tight">{contact.fullName}</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <ContactForm action={updateContact.bind(null, contact.id)} initial={contact} submitLabel="Сохранить" />
      </div>
    </div>
  );
}
