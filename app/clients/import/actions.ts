"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseClientTable, planImport, type ExistingCompany, type ImportStep } from "@/lib/clients-import";

export type PreviewRow = {
  name: string;
  match: string | null;
  fills: string[];
  newContacts: string[];
  updatedContacts: string[];
};

export type ImportResult = { preview?: PreviewRow[]; done?: { created: number; merged: number; contacts: number }; error?: string };

// Что изменится у найденного клиента: дополняются только пустые поля, заметка дописывается
function fills(step: ImportStep, current: ExistingCompany | undefined) {
  if (!current) return [];
  const changed = (a: string | null, b: string | null) => (a ?? "") !== (b?.trim() ?? "");
  return [
    changed(step.website, current.website) && "сайт",
    changed(step.email, current.email) && "почта",
    changed(step.phone, current.phone) && "телефон",
    changed(step.notes, current.notes) && "заметка",
  ].filter((v): v is string => !!v);
}

export async function previewImport(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  const rows = parseClientTable(String(formData.get("table") ?? ""));
  const existing = await db.company.findMany({
    select: {
      id: true,
      name: true,
      website: true,
      email: true,
      phone: true,
      notes: true,
      contacts: { select: { id: true, fullName: true, email: true, phone: true } },
    },
  });
  const steps = planImport(rows, existing);
  if (!steps.length) return { error: "В таблице нет ни одной строки с названием компании" };

  if (formData.get("intent") !== "apply") {
    const byId = new Map(existing.map((c) => [c.id, c]));
    return {
      preview: steps.map((s) => ({
        name: s.row.name,
        match: s.match?.name ?? null,
        fills: fills(s, s.match ? byId.get(s.match.id) : undefined),
        newContacts: s.newContacts.map((c) => c.fullName),
        updatedContacts: s.contactUpdates.map((c) => c.fullName),
      })),
    };
  }

  let created = 0;
  let merged = 0;
  let contacts = 0;
  await db.$transaction(
    async (tx) => {
      for (const s of steps) {
        const data = { website: s.website, email: s.email, phone: s.phone, notes: s.notes, contacts: { create: s.newContacts } };
        if (s.match) {
          await tx.company.update({ where: { id: s.match.id }, data });
          merged++;
        } else {
          await tx.company.create({ data: { name: s.row.name, ...data } });
          created++;
        }
        for (const u of s.contactUpdates) {
          await tx.contact.update({ where: { id: u.id }, data: { email: u.email, phone: u.phone } });
        }
        contacts += s.newContacts.length;
      }
    },
    { timeout: 60_000 },
  );
  revalidatePath("/clients");
  revalidatePath("/sales-map");
  return { done: { created, merged, contacts } };
}
