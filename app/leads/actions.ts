"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LeadStatus, Service } from "@prisma/client";
import { db } from "@/lib/db";
import { invalid, optionalEmail, optionalPhone, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";
import { isSalesStep } from "@/lib/sales-map";

const leadSchema = z
  .object({
    name: optionalText,
    phone: optionalPhone,
    email: optionalEmail,
    companyName: optionalText,
    message: optionalText,
    owner: optionalText,
  })
  .refine((l) => l.name || l.phone || l.email, { message: "Укажите имя, телефон или email", path: ["name"] });

export async function createLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = leadSchema.safeParse(
    Object.fromEntries(["name", "phone", "email", "companyName", "message", "owner"].map((k) => [k, formData.get(k) ?? null])),
  );
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);

  const lead = await db.lead.create({ data: { ...parsed.data, source: "MANUAL" } });
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  await db.lead.update({ where: { id }, data: { status, rejectReason: null } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

const rejectSchema = z.object({ rejectReason: z.string().trim().min(1, "Укажите причину") });

export async function rejectLead(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(rejectSchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);

  await db.lead.update({ where: { id }, data: { status: "REJECTED", rejectReason: parsed.data.rejectReason } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { saved: true };
}

const convertSchema = z
  .object({
    companyId: optionalText,
    companyName: optionalText,
    title: z.string().trim().min(1, "Укажите название сделки"),
    productId: optionalText,
    quantity: z.coerce.number().int().min(1, "Количество от 1").default(1),
    amount: z.coerce.number().int("Сумма в целых рублях").min(0, "Сумма не может быть отрицательной"),
    service: z.nativeEnum(Service),
    salesStep: optionalText.refine((v) => v === null || isSalesStep(v), "Нет такого шага планограммы"),
    owner: optionalText,
  })
  .refine((d) => d.companyId || d.companyName, {
    message: "Выберите клиента или укажите название нового",
    path: ["companyName"],
  });

export async function convertLead(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = convertSchema.safeParse(
    Object.fromEntries(
      ["companyId", "companyName", "title", "productId", "quantity", "amount", "service", "salesStep", "owner"].map((k) => [k, formData.get(k) ?? null]),
    ),
  );
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);
  const d = parsed.data;

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return invalid({ title: "Лид не найден" }, formData);
  if (lead.dealId) return invalid({ title: "Из этого лида уже создана сделка" }, formData);

  const firstStage = await db.stage.findFirst({ where: { kind: "OPEN" }, orderBy: { order: "asc" } });
  if (!firstStage) return invalid({ title: "В воронке нет открытых этапов" }, formData);

  const deal = await db.$transaction(async (tx) => {
    const companyId = d.companyId ?? (await tx.company.create({ data: { name: d.companyName! } })).id;

    // Контакт из заявки: не плодим дубль, если у клиента уже есть человек с тем же телефоном или email
    let contactId: string | null = null;
    if (lead.name || lead.phone || lead.email) {
      const same = await tx.contact.findFirst({
        where: {
          companyId,
          OR: [
            ...(lead.phone ? [{ phone: lead.phone }] : []),
            ...(lead.email ? [{ email: lead.email }] : []),
          ],
        },
      });
      contactId =
        (lead.phone || lead.email) && same
          ? same.id
          : (
              await tx.contact.create({
                data: { companyId, fullName: lead.name ?? lead.phone ?? lead.email!, phone: lead.phone, email: lead.email },
              })
            ).id;
    }

    const top = await tx.deal.findFirst({
      where: { stageId: firstStage.id },
      orderBy: { position: "asc" },
      select: { position: true },
    });
    const deal = await tx.deal.create({
      data: {
        title: d.title,
        productId: d.productId,
        quantity: d.quantity,
        amount: d.amount,
        service: d.service,
        salesStep: d.salesStep,
        owner: d.owner ?? lead.owner,
        notes: lead.message,
        companyId,
        contactId,
        stageId: firstStage.id,
        position: (top?.position ?? 1) - 1,
      },
    });
    await tx.lead.update({ where: { id }, data: { status: "CONVERTED", dealId: deal.id, rejectReason: null } });
    return deal;
  });

  revalidatePath("/leads");
  revalidatePath("/deals");
  revalidatePath("/clients");
  redirect(`/deals/${deal.id}`);
}
