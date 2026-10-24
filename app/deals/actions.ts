"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Service } from "@prisma/client";
import { db } from "@/lib/db";
import { invalid, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";
import { isSalesStep } from "@/lib/sales-map";
import { getOwner } from "@/lib/profile";

const dealSchema = z.object({
  title: z.string().trim().min(1, "Укажите название сделки"),
  companyId: z.string().min(1, "Выберите клиента"),
  contactId: optionalText,
  productId: optionalText,
  quantity: z.coerce.number().int().min(1, "Количество от 1").default(1),
  amount: z.coerce.number().int("Сумма в целых рублях").min(0, "Сумма не может быть отрицательной"),
  service: z.nativeEnum(Service),
  salesStep: optionalText.refine((v) => v === null || isSalesStep(v), "Нет такого шага планограммы"),
  owner: optionalText,
  startDate: optionalText.refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Неверная дата"),
  expectedCloseDate: optionalText,
  lostReason: optionalText,
  notes: optionalText,
  stageId: z.string().min(1),
});

type Validated =
  | { errors: Record<string, string> }
  | {
      data: Omit<z.infer<typeof dealSchema>, "expectedCloseDate" | "startDate"> & {
        expectedCloseDate: Date | null;
        startDate: Date | undefined;
      };
    };

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
    data: {
      ...d,
      // Пустая дата начала: при создании — сегодня, при правке — без изменений
      startDate: d.startDate ? new Date(d.startDate) : undefined,
      expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
    },
  }
}

function revalidateDeal(companyId: string) {
  revalidatePath("/deals");
  revalidatePath(`/clients/${companyId}`);
  revalidatePath("/clients");
  revalidatePath("/sales-map");
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

const quickSchema = z.object({
  title: z.string().trim().min(1, "Укажите название сделки").max(200, "Слишком длинное название"),
  clientName: z.string().trim().min(1, "Укажите клиента").max(200, "Слишком длинное название клиента"),
  amount: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.coerce.number().int("Сумма в целых рублях").min(0, "Сумма не может быть отрицательной")),
});

// Быстрая сделка из колонки воронки: клиент ищется по названию, а если его нет — создаётся
export async function quickCreateDeal(
  stageId: string,
  input: { title: string; clientName: string; amount: string },
): Promise<{ error?: string }> {
  const parsed = quickSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { title, clientName, amount } = parsed.data;
  if (!(await db.stage.findUnique({ where: { id: stageId }, select: { id: true } }))) {
    return { error: "Этап не найден, обновите страницу" };
  }

  const company =
    (await db.company.findFirst({
      where: { name: { equals: clientName, mode: "insensitive" } },
      select: { id: true },
    })) ?? (await db.company.create({ data: { name: clientName }, select: { id: true } }));
  const top = await db.deal.findFirst({ where: { stageId }, orderBy: { position: "asc" }, select: { position: true } });
  await db.deal.create({
    // Ответственный за быструю сделку — владелец CRM, его можно сменить в карточке
    data: { title, amount, owner: (await getOwner()).name, companyId: company.id, stageId, position: (top?.position ?? 1) - 1 },
  });
  revalidateDeal(company.id);
  return {};
}

export async function moveDeal(id: string, stageId: string, position: number) {
  const deal = await db.deal.update({ where: { id }, data: { stageId, position } });
  revalidateDeal(deal.companyId);
}
