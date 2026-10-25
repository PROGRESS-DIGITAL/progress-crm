"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { findPartyByInn, getDadataKey, type PartyInfo } from "@/lib/dadata";
import { invalid, optionalEmail, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";
import { isSituation } from "@/lib/sales-map";
import { findDuplicate, mergeCompanies, mergeFields } from "@/lib/company-merge";

const companySchema = z.object({
  name: z.string().trim().min(1, "Укажите название компании"),
  inn: optionalText.refine((v) => v === null || /^\d{10}(\d{2})?$/.test(v), "ИНН — 10 или 12 цифр"),
  kpp: optionalText.refine((v) => v === null || /^\d{9}$/.test(v), "КПП — 9 цифр"),
  ogrn: optionalText.refine((v) => v === null || /^\d{13}(\d{2})?$/.test(v), "ОГРН — 13 или 15 цифр"),
  director: optionalText,
  website: optionalText,
  phone: optionalText,
  email: optionalEmail,
  address: optionalText,
  notes: optionalText,
  situation: optionalText.refine((v) => v === null || isSituation(v), "Нет такой ситуации"),
});

// Реквизиты по ИНН из DaData; сохраняет их уже сама форма, после проверки менеджером
export async function lookupInn(inn: string): Promise<{ party?: PartyInfo; error?: string }> {
  const clean = inn.replace(/\s/g, "");
  if (!/^\d{10}(\d{2})?$/.test(clean)) return { error: "ИНН — 10 или 12 цифр" };
  const key = await getDadataKey();
  if (!key) return { error: "no-key" };
  return findPartyByInn(clean, key);
}

const contactSchema = z.object({
  fullName: z.string().trim().min(1, "Укажите имя"),
  position: optionalText,
  phone: optionalText,
  email: optionalEmail,
  notes: optionalText,
});

// Ответ на вопрос о дубле: "merge:<id>" — объединить с ним, "separate" — оставить отдельно
function duplicateChoice(formData: FormData) {
  const choice = String(formData.get("duplicateChoice") ?? "");
  if (choice === "separate") return { separate: true as const };
  if (choice.startsWith("merge:")) return { mergeWith: choice.slice(6) };
  return {};
}

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(companySchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);
  const choice = duplicateChoice(formData);

  if (choice.mergeWith) {
    // Новый клиент не создаётся: введённое дополняет найденного
    const existing = await db.company.findUnique({ where: { id: choice.mergeWith } });
    if (existing) {
      await db.company.update({ where: { id: existing.id }, data: mergeFields(existing, parsed.data) });
      revalidatePath("/clients");
      redirect(`/clients/${existing.id}?merged=1`);
    }
  }
  if (!choice.separate) {
    const duplicate = await findDuplicate(parsed.data);
    if (duplicate) return { ...invalid({}, formData), duplicate };
  }

  const company = await db.company.create({ data: parsed.data });
  revalidatePath("/clients");
  redirect(`/clients/${company.id}`);
}

export async function updateCompany(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(companySchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);
  const choice = duplicateChoice(formData);

  if (choice.mergeWith && choice.mergeWith !== id) {
    // Этот клиент остаётся, второй переезжает в него со сделками и контактами
    await mergeCompanies(id, choice.mergeWith, parsed.data);
    revalidatePath("/clients");
    revalidatePath("/deals");
    revalidatePath("/sales-map");
    redirect(`/clients/${id}?merged=1`);
  }
  if (!choice.separate) {
    const duplicate = await findDuplicate(parsed.data, id);
    if (duplicate) return { ...invalid({}, formData), duplicate };
  }

  await db.company.update({ where: { id }, data: parsed.data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/deals");
  revalidatePath("/sales-map");
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
