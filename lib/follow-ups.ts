import { db } from "@/lib/db";
import { addDays, dayKey, fromKey, minutesOfDay } from "@/lib/calendar";
import { getSetting, setSetting } from "@/lib/settings";
import { SALES_STEPS, type SalesStep } from "@/lib/sales-map";
import { getClientPlan } from "@/lib/sales-map-data";
import { daysLabel } from "@/lib/format";

// Повторные продажи: через N дней после оплаты CRM ставит задачу предложить клиенту следующий шаг по планограмме
export const FOLLOW_UP_SETTING = "followUp.days";
export const DEFAULT_FOLLOW_UP_DAYS = 30;
export const FOLLOW_UP_OPTIONS = [14, 30, 45, 60, 90];
// Оплаты старше «N дней + окно» не поднимаем: при включении CRM не завалит задачами по давним сделкам
const WINDOW_DAYS = 14;
const MAX_STEPS = 3;

// 0 — выключено
export async function followUpDays() {
  const raw = await getSetting(FOLLOW_UP_SETTING);
  if (raw === null) return DEFAULT_FOLLOW_UP_DAYS;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_FOLLOW_UP_DAYS;
}

export async function setFollowUpDays(days: number) {
  await setSetting(FOLLOW_UP_SETTING, String(days));
}

// Какие оплаты пора поднять: закрыты N дней назад или раньше, но не позже окна
export function followUpRange(now: Date, days: number) {
  const today = dayKey(now);
  return { from: fromKey(addDays(today, -(days + WINDOW_DAYS))), to: fromKey(addDays(today, -days + 1)) };
}

export function followUpTitle(company: string) {
  return `Предложить следующий шаг: ${company}`;
}

export function followUpNotes(paid: string, days: number, steps: SalesStep[]) {
  return [
    `${daysLabel(days)} назад оплачено «${paid}».`,
    `По планограмме дальше: ${steps.slice(0, MAX_STEPS).map((s) => SALES_STEPS[s]).join(", ")}.`,
    "Свяжитесь с клиентом и предложите следующий шаг. Новую сделку удобно создать из карточки клиента.",
  ].join("\n");
}

export type FollowUp = { company: string; paid: string; steps: SalesStep[] };

export function followUpDigest(items: FollowUp[]) {
  return [
    items.length === 1 ? "🔁 Пора предложить клиенту следующий шаг" : `🔁 Пора предложить следующий шаг клиентам: ${items.length}`,
    ...items.map((i) => `• ${i.company}: ${i.steps.slice(0, MAX_STEPS).map((s) => SALES_STEPS[s].toLowerCase()).join(", ")} (оплачено «${i.paid}»)`),
    "",
    "Задачи уже поставлены в CRM.",
  ].join("\n");
}

// С 10:00 по Москве, раз в 15 минут: задачи по оплатам, у которых подошёл срок
export async function runFollowUps(now = new Date()) {
  if (minutesOfDay(now) < 10 * 60) return 0;
  const days = await followUpDays();
  if (!days) return 0;
  const { from, to } = followUpRange(now, days);
  const paid = await db.deal.findMany({
    where: { followUpAt: null, stage: { kind: "WON" }, closedAt: { gte: from, lt: to } },
    orderBy: { closedAt: "desc" },
    select: {
      id: true,
      title: true,
      owner: true,
      closedAt: true,
      company: { select: { id: true, name: true, situation: true } },
    },
  });
  // Одна задача на клиента, по последней оплате
  const byCompany = new Map<string, typeof paid>();
  for (const d of paid) byCompany.set(d.company.id, [...(byCompany.get(d.company.id) ?? []), d]);

  const created: FollowUp[] = [];
  for (const deals of byCompany.values()) {
    const last = deals[0];
    const company = last.company;
    // Клиенту уже что-то продаём — отдельное напоминание не нужно
    const open = await db.deal.count({ where: { companyId: company.id, stage: { kind: "OPEN" } } });
    const plan = open ? null : await getClientPlan(company.id, company.situation);
    if (plan?.next.length) {
      // Ответственный за сделку: в сделке часто записано только имя, без фамилии
      const assignee = last.owner
        ? ((await db.employee.findFirst({ where: { name: last.owner }, select: { id: true } })) ??
          (await db.employee.findFirst({ where: { name: { startsWith: `${last.owner} ` } }, select: { id: true } })))
        : null;
      const ago = Math.floor((now.getTime() - last.closedAt!.getTime()) / 86_400_000);
      const today = dayKey(now);
      await db.event.create({
        data: {
          kind: "TASK",
          title: followUpTitle(company.name),
          notes: followUpNotes(last.title, ago, plan.next),
          start: fromKey(today),
          end: fromKey(addDays(today, 1)),
          allDay: true,
          companyId: company.id,
          dealId: last.id,
          assigneeId: assignee?.id ?? null,
        },
      });
      created.push({ company: company.name, paid: last.title, steps: plan.next });
    }
    // Отмечаем все оплаты клиента: повторно по ним не напоминаем
    await db.deal.updateMany({ where: { id: { in: deals.map((d) => d.id) } }, data: { followUpAt: now } });
  }
  if (created.length) {
    const { notifyOwner } = await import("@/lib/auth/notify");
    await notifyOwner(followUpDigest(created));
  }
  return created.length;
}
