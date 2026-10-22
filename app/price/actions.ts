"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Service } from "@prisma/client";
import { db } from "@/lib/db";
import { invalid, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";

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

const productSchema = z.object({
  category: z.string().trim().min(1, "Укажите раздел"),
  name: z.string().trim().min(1, "Укажите название"),
  description: optionalText,
  price,
  priceFrom: z.preprocess((v) => v === "on", z.boolean()),
  unit: optionalText,
  service: z.nativeEnum(Service),
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

// Сделки с этой услугой остаются: у них сохраняются сумма и направление
export async function deleteProduct(id: string) {
  await db.product.delete({ where: { id } });
  revalidatePrice();
}
