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
  closedAt: optionalText.refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Неверная дата"),
  lostReason: optionalText,
  notes: optionalText,
  stageId: z.string().min(1),
});

type Validated =
  | { errors: Record<string, string> }
  | {
      data: Omit<z.infer<typeof dealSchema>, "expectedCloseDate" | "startDate" | "closedAt"> & {
        expectedCloseDate: Date | null;
        startDate: Date | undefined;
        closedAt: Date | null;
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
      closedAt: d.closedAt ? new Date(d.closedAt) : null,
    },
  }
}

// Дата оплаты или проигрыша: ставится, когда сделка попадает в «Оплачен» или «Проиграна»,
// сохраняется при переносе между закрытыми этапами и снимается, если сделку вернули в работу
async function closedAtFor(
  stageId: string,
  before: { closedAt: Date | null; kind: "OPEN" | "WON" | "LOST" } | null,
  typed: Date | null = null,
) {
  const stage = await db.stage.findUnique({ where: { id: stageId }, select: { kind: true } });
  if (!stage || stage.kind === "OPEN") return null;
  if (typed) return typed;
  if (before && before.kind !== "OPEN" && before.closedAt) return before.closedAt;
  return new Date();
}

function revalidateDeal(companyId: string) {
  revalidatePath("/deals");
  revalidatePath(`/clients/${companyId}`);
  revalidatePath("/clients");
  revalidatePath("/sales-map");
  revalidatePath("/dashboard");
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
  const closedAt = await closedAtFor(result.data.stageId, null, result.data.closedAt);
  await db.deal.create({ data: { ...result.data, closedAt, position: (top?.position ?? 1) - 1 } });
  revalidateDeal(result.data.companyId);
  redirect("/deals");
}

export async function updateDeal(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const result = await validate(formData);
  if ("errors" in result) return invalid(result.errors, formData);

  const current = await db.deal.findUnique({ where: { id }, select: { closedAt: true, stage: { select: { kind: true } } } });
  const closedAt = await closedAtFor(
    result.data.stageId,
    current && { closedAt: current.closedAt, kind: current.stage.kind },
    result.data.closedAt,
  );
  const deal = await db.deal.update({ where: { id }, data: { ...result.data, closedAt }, select: { companyId: true } });
  revalidateDeal(deal.companyId);
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
    data: {
      title,
      amount,
      owner: (await getOwner()).name,
      companyId: company.id,
      stageId,
      closedAt: await closedAtFor(stageId, null),
      position: (top?.position ?? 1) - 1,
    },
  });
  revalidateDeal(company.id);
  return {};
}

// Перенос сделки в колонку или на новое место внутри колонки.
// order — id сделок колонки сверху вниз уже с перенесённой: позиции пересчитываются по нему
export async function moveDeal(id: string, stageId: string, order: string[]) {
  const current = await db.deal.findUnique({ where: { id }, select: { closedAt: true, stageId: true, stage: { select: { kind: true } } } });
  if (!current) return;
  const closedAt =
    current.stageId === stageId ? current.closedAt : await closedAtFor(stageId, { closedAt: current.closedAt, kind: current.stage.kind });
  const deal = await db.deal.update({ where: { id }, data: { stageId, closedAt } });
  await db.$transaction(order.map((dealId, position) => db.deal.updateMany({ where: { id: dealId, stageId }, data: { position } })));
  revalidateDeal(deal.companyId);
}
