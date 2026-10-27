"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Service } from "@prisma/client";
import { db } from "@/lib/db";
import { invalid, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";
import { isSalesStep } from "@/lib/sales-map";

const salesStep = optionalText.refine((v) => v === null || isSalesStep(v), "Нет такого шага планограммы");

const price = z.coerce.number().int("Цена в целых рублях").min(0, "Цена не может быть отрицательной");

function revalidatePrice() {
  revalidatePath("/price");
  revalidatePath("/deals/new");
}

export async function updateProductPrice(id: string, value: number): Promise<{ error?: string }> {
  const parsed = price.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.product.update({ where: { id }, data: { price: parsed.data } });
  revalidatePrice();
  return {};
}

const textFields = {
  name: z.string().trim().min(1, "Название не может быть пустым").max(200, "Слишком длинное название"),
  description: z
    .string()
    .trim()
    .max(1000, "Слишком длинное описание")
    .transform((v) => (v === "" ? null : v)),
};

export async function updateProductStep(id: string, value: string): Promise<{ error?: string }> {
  const parsed = salesStep.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.product.update({ where: { id }, data: { salesStep: parsed.data } });
  revalidatePrice();
  revalidatePath("/sales-map");
  return {};
}

export async function updateProductText(
  id: string,
  field: keyof typeof textFields,
  value: string,
): Promise<{ error?: string }> {
  const parsed = textFields[field].safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.product.update({ where: { id }, data: { [field]: parsed.data } });
  revalidatePrice();
  return {};
}

const productSchema = z.object({
  category: z.string().trim().min(1, "Укажите раздел"),
  name: z.string().trim().min(1, "Укажите название"),
  description: optionalText,
  price,
  unit: optionalText,
  service: z.nativeEnum(Service),
  salesStep,
});

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(productSchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);

  const last = await db.product.findFirst({
    where: { category: parsed.data.category },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.product.create({ data: { ...parsed.data, sortOrder: (last?.sortOrder ?? 0) + 10 } });
  revalidatePrice();
  return { saved: true };
}

// Правка услуги целиком; сумма в уже созданных сделках не меняется
export async function updateProduct(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(productSchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);
  await db.product.update({ where: { id }, data: parsed.data });
  revalidatePrice();
  revalidatePath("/sales-map");
  return { saved: true };
}

// Новый порядок услуг в разделе после перетаскивания
export async function reorderProducts(category: string, ids: string[]): Promise<{ error?: string }> {
  const current = await db.product.findMany({ where: { category }, select: { id: true } });
  const known = new Set(current.map((p) => p.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
    return { error: "Прайс изменился, обновите страницу" };
  }
  await db.$transaction(ids.map((id, i) => db.product.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } })));
  revalidatePrice();
  return {};
}

// Сделки с этой услугой остаются: у них сохраняются сумма и направление
export async function deleteProduct(id: string) {
  await db.product.delete({ where: { id } });
  revalidatePrice();
}
