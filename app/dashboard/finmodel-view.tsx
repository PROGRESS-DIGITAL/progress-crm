import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { FINMODEL_SETTING, parseFinModel } from "@/lib/finmodel";
import { emptyMonth, monthKey, monthLabel, monthlyStats, shiftMonth } from "@/lib/monthly";
import { FinModelEditor } from "./finmodel-editor";

// Вкладка «Финмодель»: план по сценариям, который можно править, и факт месяца рядом
export async function FinModelView() {
  const now = monthKey(new Date());
  const [saved, deals, bank] = await Promise.all([
    getSetting(FINMODEL_SETTING),
    db.deal.findMany({ select: { amount: true, startDate: true, closedAt: true, stage: { select: { kind: true } } } }),
    db.bankPayment.findMany({ select: { date: true, amount: true }, where: { date: { gte: new Date(Date.now() - 70 * 86_400_000) } } }),
  ]);
  const stats = monthlyStats(deals.map((d) => ({ ...d, kind: d.stage.kind })));
  const month = (key: string) => ({
    label: monthLabel(key),
    revenue: (stats.get(key) ?? emptyMonth(key)).revenue,
    bank: bank.filter((p) => monthKey(p.date) === key).reduce((a, p) => a + p.amount, 0),
  });

  return (
    <FinModelEditor
      initial={parseFinModel(saved)}
      isNew={!saved}
      fact={{ current: month(now), previous: month(shiftMonth(now, -1)) }}
    />
  );
}
