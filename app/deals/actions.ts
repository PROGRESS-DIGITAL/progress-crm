"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Service } from "@prisma/client";
import { db } from "@/lib/db";
import { invalid, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";

const dealSchema = z.object({
  title: z.string().trim().min(1, "Укажите название сделки"),
  companyId: z.string().min(1, "Выберите клиента"),
  contactId: optionalText,
  productId: optionalText,
  quantity: z.coerce.number().int().min(1, "Количество от 1").default(1),
  amount: z.coerce.number().int("Сумма в целых рублях").min(0, "Сумма не может быть отрицательной"),
  service: z.nativeEnum(Service),
  owner: optionalText,
  expectedCloseDate: optionalText,
  lostReason: optionalText,
  notes: optionalText,
  stageId: z.string().min(1),
});

type Validated =
  | { errors: Record<string, string> }
  | { data: Omit<z.infer<typeof dealSchema>, "expectedCloseDate"> & { expectedCloseDate: Date | null } };

async function validate(formData: FormData): Promise<Validated> {
  const parsed = parseForm(dealSchema, formData);
  if (!parsed.success) return { errors: toErrors(parsed.error) }
  const d = parsed.data;
  // Контакт должен принадлежать выбранной компании
  if (d.contactId) {
    const contact = await db.contact.findUnique({ where: { id: d.contactId }, select: { companyId: true } });
    if (contact?.companyId !== d.companyId) {
      return { errors: { contactId: "Контакт не относится к выбранному клиенту" } }
    }
  }
  if (d.productId && !(await db.product.findUnique({ where: { id: d.productId }, select: { id: true } }))) {
    return { errors: { productId: "Услуга не найдена в прайсе" } };
  }
  return {
    data: { ...d, expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null },
  }
}

function revalidateDeal(companyId: string) {
  revalidatePath("/deals");
  revalidatePath(`/clients/${companyId}`);
  revalidatePath("/clients");
}

export async function createDeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await validate(formData);
  if ("errors" in result) return invalid(result.errors, formData);

  // Новая сделка встаёт наверх своей колонки
  const top = await db.deal.findFirst({
    where: { stageId: result.data.stageId },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  await db.deal.create({ data: { ...result.data, position: (top?.position ?? 1) - 1 } });
  revalidateDeal(result.data.companyId);
  redirect("/deals");
}

export async function updateDeal(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const result = await validate(formData);
  if ("errors" in result) return invalid(result.errors, formData);

  const before = await db.deal.update({ where: { id }, data: result.data, select: { companyId: true } });
  revalidateDeal(before.companyId);
  redirect("/deals");
}

export async function deleteDeal(id: string) {
  const deal = await db.deal.delete({ where: { id } });
  revalidateDeal(deal.companyId);
  redirect("/deals");
}

export async function moveDeal(id: string, stageId: string, position: number) {
  const deal = await db.deal.update({ where: { id }, data: { stageId, position } });
  revalidateDeal(deal.companyId);
}
