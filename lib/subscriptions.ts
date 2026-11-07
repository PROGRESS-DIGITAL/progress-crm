import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays, dayKey, fromKey, minutesOfDay } from "@/lib/calendar";
import { formatRub } from "@/lib/format";
import { monthKey, monthLabel, type MonthKey } from "@/lib/monthly";

// Абонементы: каждый месяц в день счёта CRM заводит сделку месяца и задачу «Выставить счёт».
// Счёт выставляется из сделки как обычно, оплата переводит её в «Оплачен» и попадает в выручку месяца

export const MAX_BILLING_DAY = 28;

type Period = { startMonth: string; endMonth: string | null; active: boolean };

// Абонемент действует в этом месяце: включён и месяц в пределах «с — по»
export function activeIn(s: Period, month: MonthKey) {
  return (
    s.active && s.startMonth <= month && (!s.endMonth || month <= s.endMonth)
  );
}

// Московская дата дня счёта в месяце
export function billingDayKey(month: MonthKey, billingDay: number) {
  return `${month}-${String(Math.min(Math.max(billingDay, 1), MAX_BILLING_DAY)).padStart(2, "0")}`;
}

// Пора заводить сделку месяца: абонемент действует, и день счёта уже наступил
export function isDue(s: Period & { billingDay: number }, now: Date) {
  const month = monthKey(now);
  return (
    activeIn(s, month) && dayKey(now) >= billingDayKey(month, s.billingDay)
  );
}

// Сколько приносят абонементы в месяц
export function monthlyTotal(
  subs: (Period & { amount: number })[],
  month: MonthKey,
) {
  return subs
    .filter((s) => activeIn(s, month))
    .reduce((a, s) => a + s.amount, 0);
}

export function periodTitle(title: string, month: MonthKey) {
  return `${title} · ${monthLabel(month).toLowerCase()}`;
}

// Этап для сделки месяца: «Счёт на оплату», если такой есть, иначе первый открытый
async function invoiceStage() {
  const open = await db.stage.findMany({
    where: { kind: "OPEN" },
    orderBy: { order: "asc" },
  });
  return (
    open.find((s) => /сч[её]т/i.test(s.name) && !/финал/i.test(s.name)) ??
    open[0] ??
    null
  );
}

export type CreatedPeriod = {
  company: string;
  title: string;
  amount: number;
  month: MonthKey;
  dealId: string;
};

// Завести сделку и задачу за месяц. Повторный вызов за тот же месяц ничего не делает
export async function createPeriod(
  subscriptionId: string,
  month: MonthKey,
): Promise<CreatedPeriod | null> {
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { company: { select: { name: true } } },
  });
  if (!sub) return null;
  const stage = await invoiceStage();
  if (!stage) return null;
  const day = billingDayKey(month, sub.billingDay);
  try {
    return await db.$transaction(async (tx) => {
      // Сначала месяц: уникальный ключ не даст завести вторую сделку за тот же месяц
      const period = await tx.subscriptionPeriod.create({
        data: { subscriptionId: sub.id, month, amount: sub.amount },
      });
      const deal = await tx.deal.create({
        data: {
          title: periodTitle(sub.title, month),
          companyId: sub.companyId,
          amount: sub.amount,
          service: sub.service,
          stageId: stage.id,
          startDate: fromKey(day),
          expectedCloseDate: fromKey(addDays(day, 7)),
          notes: "Сделка месяца по LTV-платежу",
        },
      });
      await tx.subscriptionPeriod.update({
        where: { id: period.id },
        data: { dealId: deal.id },
      });
      await tx.event.create({
        data: {
          kind: "TASK",
          title: `Выставить счёт: ${sub.company.name}, ${sub.title} за ${monthLabel(month).toLowerCase()}`,
          notes: `LTV-платёж ${formatRub(sub.amount)} в месяц. Счёт выставляется в карточке сделки.`,
          start: fromKey(day),
          end: fromKey(addDays(day, 1)),
          allDay: true,
          companyId: sub.companyId,
          dealId: deal.id,
        },
      });
      return {
        company: sub.company.name,
        title: sub.title,
        amount: sub.amount,
        month,
        dealId: deal.id,
      };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return null;
    throw e;
  }
}

export function invoiceReminderText(created: CreatedPeriod[]) {
  const lines = created.map(
    (c) => `• ${c.company}: ${c.title}, ${formatRub(c.amount)}`,
  );
  return [
    created.length === 1
      ? "🧾 Пора выставить счёт по LTV-платежу"
      : `🧾 Пора выставить счета по LTV-платежам: ${created.length}`,
    ...lines,
    "",
    "Сделки месяца и задачи уже заведены в CRM.",
  ].join("\n");
}

// С 9:00 по Москве: ночью в Telegram не пишем
const RUN_FROM = 9 * 60;

// Каждые 15 минут: завести сделки месяца по абонементам, у которых наступил день счёта, и написать в Telegram
export async function runSubscriptions(now = new Date()) {
  if (minutesOfDay(now) < RUN_FROM) return 0;
  const month = monthKey(now);
  const subs = await db.subscription.findMany({
    where: { active: true, periods: { none: { month } } },
    select: {
      id: true,
      startMonth: true,
      endMonth: true,
      active: true,
      billingDay: true,
    },
  });
  const created: CreatedPeriod[] = [];
  for (const s of subs.filter((s) => isDue(s, now))) {
    const c = await createPeriod(s.id, month);
    if (c) created.push(c);
  }
  if (created.length) {
    const { notifyOwner } = await import("@/lib/auth/notify");
    await notifyOwner(invoiceReminderText(created));
  }
  return created.length;
}
