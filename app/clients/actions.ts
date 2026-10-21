"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { invalid, optionalEmail, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";

const companySchema = z.object({
  name: z.string().trim().min(1, "Укажите название компании"),
  inn: optionalText.refine((v) => v === null || /^\d{10}(\d{2})?$/.test(v), "ИНН — 10 или 12 цифр"),
  website: optionalText,
  phone: optionalText,
  email: optionalEmail,
  address: optionalText,
  notes: optionalText,
});

const contactSchema = z.object({
  fullName: z.string().trim().min(1, "Укажите имя"),
  position: optionalText,
  phone: optionalText,
  email: optionalEmail,
  notes: optionalText,
});

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(companySchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);

  const company = await db.company.create({ data: parsed.data });
  revalidatePath("/clients");
  redirect(`/clients/${company.id}`);
}

export async function updateCompany(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(companySchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);

  await db.company.update({ where: { id }, data: parsed.data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/deals");
  return { saved: true };
}

export async function deleteCompany(id: string) {
  // Сделки не удаляем вместе с клиентом: история продаж важнее
  const deals = await db.deal.count({ where: { companyId: id } });
  if (deals > 0) redirect(`/clients/${id}?error=has-deals`);

  await db.company.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function createContact(companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(contactSchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);

  await db.contact.create({ data: { ...parsed.data, companyId } });
  revalidatePath(`/clients/${companyId}`);
  revalidatePath("/clients");
  return { saved: true };
}

export async function updateContact(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(contactSchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);

  const contact = await db.contact.update({ where: { id }, data: parsed.data });
  revalidatePath(`/clients/${contact.companyId}`);
  redirect(`/clients/${contact.companyId}`);
}

export async function deleteContact(id: string) {
  const contact = await db.contact.delete({ where: { id } });
  revalidatePath(`/clients/${contact.companyId}`);
  revalidatePath("/clients");
  revalidatePath("/deals");
}
