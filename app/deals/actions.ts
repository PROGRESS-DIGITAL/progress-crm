"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Service } from "@prisma/client";
import { db } from "@/lib/db";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const dealSchema = z.object({
  title: z.string().trim().min(1, "Укажите название сделки"),
  clientName: z.string().trim().min(1, "Укажите клиента"),
  contactName: optionalText,
  phone: optionalText,
  email: optionalText.refine((v) => v === null || z.string().email().safeParse(v).success, "Некорректный email"),
  amount: z.coerce.number().int("Сумма в целых рублях").min(0, "Сумма не может быть отрицательной"),
  service: z.nativeEnum(Service),
  owner: optionalText,
  expectedCloseDate: optionalText,
  lostReason: optionalText,
  notes: optionalText,
  stageId: z.string().min(1),
});

export type DealFormState = { errors?: Record<string, string> } | undefined;

function parseDeal(formData: FormData) {
  const raw = Object.fromEntries(
    Object.keys(dealSchema.shape).map((k) => [k, formData.get(k) ?? null]),
  );
  return dealSchema.safeParse(raw);
}

function toErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    errors[key] ??= issue.message;
  }
  return errors;
}

function toData(d: z.infer<typeof dealSchema>) {
  return {
    ...d,
    expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
  };
}

export async function createDeal(_prev: DealFormState, formData: FormData): Promise<DealFormState> {
  const parsed = parseDeal(formData);
  if (!parsed.success) return { errors: toErrors(parsed.error) };

  // Новая сделка встаёт наверх своей колонки
  const top = await db.deal.findFirst({
    where: { stageId: parsed.data.stageId },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  await db.deal.create({
    data: { ...toData(parsed.data), position: (top?.position ?? 1) - 1 },
  });
  revalidatePath("/deals");
  redirect("/deals");
}

export async function updateDeal(
  id: string,
  _prev: DealFormState,
  formData: FormData,
): Promise<DealFormState> {
  const parsed = parseDeal(formData);
  if (!parsed.success) return { errors: toErrors(parsed.error) };

  await db.deal.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/deals");
  redirect("/deals");
}

export async function deleteDeal(id: string) {
  await db.deal.delete({ where: { id } });
  revalidatePath("/deals");
  redirect("/deals");
}

export async function moveDeal(id: string, stageId: string, position: number) {
  await db.deal.update({ where: { id }, data: { stageId, position } });
  revalidatePath("/deals");
}
