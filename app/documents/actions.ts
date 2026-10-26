"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import mammoth from "mammoth";
import { db } from "@/lib/db";
import { fromKey, isDayKey } from "@/lib/calendar";
import { invalid, optionalEmail, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";
import { sanitizeHtml } from "@/lib/contracts/sanitize";
import { createContract, saveExecutor } from "@/lib/contracts/store";
import { updateContractFields } from "@/lib/contracts/fields";

export type SaveState = { saved?: boolean; error?: string } | undefined;

const MAX_DOCX = 15 * 1024 * 1024;

// .docx → HTML: абзацы, списки, таблицы, жирный и курсив; картинки встраиваются в шаблон
export async function createTemplate(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const file = formData.get("file");
  let name = String(formData.get("name") ?? "").trim();
  let body = "<p></p>";
  if (file instanceof File && file.size > 0) {
    if (!/\.docx$/i.test(file.name)) return { error: "Нужен файл .docx. Старый .doc сначала пересохраните в Word как .docx." };
    if (file.size > MAX_DOCX) return { error: "Файл больше 15 МБ." };
    try {
      const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(await file.arrayBuffer()) });
      body = sanitizeHtml(value) || body;
    } catch {
      return { error: "Не получилось прочитать файл. Проверьте, что это документ Word .docx." };
    }
    name ||= file.name.replace(/\.docx$/i, "").trim();
  }
  if (!name) return { error: "Укажите название шаблона или выберите файл." };
  const t = await db.contractTemplate.create({ data: { name, body } });
  revalidatePath("/documents");
  redirect(`/documents/templates/${t.id}`);
}

export async function saveTemplate(id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Укажите название шаблона." };
  await db.contractTemplate.update({ where: { id }, data: { name, body: sanitizeHtml(String(formData.get("body") ?? "")) } });
  revalidatePath("/documents");
  revalidatePath(`/documents/templates/${id}`);
  return { saved: true };
}

export async function deleteTemplate(id: string) {
  await db.contractTemplate.delete({ where: { id } });
  revalidatePath("/documents");
  redirect("/documents?tab=templates");
}

export type CreateContractState = { error?: string } | undefined;

export async function createContractAction(dealId: string, _prev: CreateContractState, formData: FormData): Promise<CreateContractState> {
  const templateId = String(formData.get("templateId") ?? "");
  const number = String(formData.get("number") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!templateId) return { error: "Выберите шаблон." };
  if (!number) return { error: "Укажите номер договора." };
  if (!isDayKey(date)) return { error: "Укажите дату договора." };
  const { contract, missing } = await createContract({ templateId, dealId, number, date: fromKey(date, 12 * 60) });
  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/documents");
  const query = missing.length ? `?missing=${encodeURIComponent(missing.join("|"))}` : "";
  redirect(`/documents/contracts/${contract.id}${query}`);
}

export async function saveContract(id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const number = String(formData.get("number") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!number) return { error: "Укажите номер договора." };
  if (!isDayKey(date)) return { error: "Укажите дату договора." };
  const day = fromKey(date, 12 * 60);
  const body = updateContractFields(sanitizeHtml(String(formData.get("body") ?? "")), number, day);
  const contract = await db.contract.update({ where: { id }, data: { number, date: day, body } });
  revalidatePath("/documents");
  revalidatePath(`/documents/contracts/${id}`);
  if (contract.dealId) revalidatePath(`/deals/${contract.dealId}`);
  return { saved: true };
}

export async function deleteContract(id: string) {
  const contract = await db.contract.delete({ where: { id } });
  revalidatePath("/documents");
  if (contract.dealId) {
    revalidatePath(`/deals/${contract.dealId}`);
    redirect(`/deals/${contract.dealId}`);
  }
  redirect("/documents");
}

const digits = (n: number, message: string) =>
  optionalText
    .transform((v) => v?.replace(/\s/g, "") || null)
    .refine((v) => v === null || new RegExp(`^\\d{${n}}$`).test(v), message);

const executorSchema = z.object({
  name: z.string().trim().min(1, "Укажите название: например, ИП Иванов Иван Иванович"),
  inn: optionalText.refine((v) => v === null || /^\d{10}(\d{2})?$/.test(v), "ИНН — 10 или 12 цифр"),
  kpp: optionalText.refine((v) => v === null || /^\d{9}$/.test(v), "КПП — 9 цифр"),
  ogrn: optionalText.refine((v) => v === null || /^\d{13}(\d{2})?$/.test(v), "ОГРН — 13 цифр, ОГРНИП — 15"),
  director: optionalText,
  address: optionalText,
  bankAccount: digits(20, "Расчётный счёт — 20 цифр"),
  corrAccount: digits(20, "Корр. счёт — 20 цифр"),
  bankName: optionalText,
  bik: digits(9, "БИК — 9 цифр"),
  phone: optionalText,
  email: optionalEmail,
  logo: optionalText.refine((v) => v === null || /^data:image\/(png|jpeg|gif|webp);base64,/.test(v), "Логотип должен быть картинкой"),
});

export async function saveExecutorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(executorSchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);
  await saveExecutor(parsed.data);
  revalidatePath("/documents");
  return { saved: true };
}
