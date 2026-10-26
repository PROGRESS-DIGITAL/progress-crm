import { db } from "@/lib/db";
import { getRemindChat } from "@/lib/reminders";
import type { TaskOptions } from "./task-form";

// Клиенты и сделки для выбора в карточке задачи
export async function taskOptions(): Promise<TaskOptions & { remindersOn: boolean }> {
  const [companies, deals, chat] = await Promise.all([
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.deal.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true, companyId: true, stage: { select: { kind: true } } } }),
    getRemindChat(),
  ]);
  return {
    companies,
    deals: deals.map((d) => ({ id: d.id, title: d.title, companyId: d.companyId, open: d.stage.kind === "OPEN" })),
    remindersOn: !!chat,
  };
}
