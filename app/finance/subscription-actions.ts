"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  invalid,
  optionalText,
  parseForm,
  toErrors,
  type FormState,
} from "@/lib/forms";
import { monthKey } from "@/lib/monthly";
import { createPeriod, isDue, MAX_BILLING_DAY } from "@/lib/subscriptions";

const month = z.string().regex(/^\d{4}-\d{2}$/, "Выберите месяц");

const schema = z.object({
  companyId: z.string().min(1, "Выберите клиента"),
  title: z
    .string()
    .trim()
    .min(1, "Введите название")
    .max(120, "Слишком длинное название"),
  service: z.enum([
    "WEBSITE",
    "SEO",
    "CONTEXT_ADS",
    "BRANDING",
    "SMM",
    "OTHER",
  ]),
  amount: z.coerce
    .number({ message: "Введите сумму" })
    .int("Сумма в целых рублях")
    .min(1, "Введите сумму")
    .max(100_000_000, "Слишком большая сумма"),
  billingDay: z.coerce
    .number()
    .int()
    .min(1, `Число от 1 до ${MAX_BILLING_DAY}`)
    .max(MAX_BILLING_DAY, `Число от 1 до ${MAX_BILLING_DAY}`),
  startMonth: month,
  endMonth: optionalText.pipe(month.nullable()),
  notes: optionalText,
});

function refresh() {
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath("/tasks");
}

// Если день счёта в этом месяце уже наступил, сделка и задача заводятся сразу, а не со следующей проверки
async function catchUp(id: string) {
  const s = await db.subscription.findUnique({ where: { id } });
  if (s && isDue(s, new Date())) await createPeriod(s.id, monthKey(new Date()));
}

export async function saveSubscription(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);
  if (parsed.data.endMonth && parsed.data.endMonth < parsed.data.startMonth) {
    return invalid({ endMonth: "Месяц окончания раньше начала" }, formData);
  }
  if (
    !(await db.company.findUnique({
      where: { id: parsed.data.companyId },
      select: { id: true },
    }))
  ) {
    return invalid({ companyId: "Клиент удалён, выберите другого" }, formData);
  }
  const saved = id
    ? await db.subscription.update({ where: { id }, data: parsed.data })
    : await db.subscription.create({ data: parsed.data });
  await catchUp(saved.id);
  refresh();
  redirect("/finance?view=subscriptions");
}

export async function setSubscriptionActive(id: string, active: boolean) {
  await db.subscription.update({ where: { id }, data: { active } });
  if (active) await catchUp(id);
  refresh();
}

// Удаляется только абонемент: уже заведённые сделки месяцев и их счета остаются
export async function deleteSubscription(id: string) {
  await db.subscription.deleteMany({ where: { id } });
  refresh();
}
