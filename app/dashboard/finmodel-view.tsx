import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { FINMODEL_SETTING, parseFinModel } from "@/lib/finmodel";
import { emptyMonth, monthKey, monthLabel, monthlyStats, shiftMonth } from "@/lib/monthly";
import { monthlyTotal } from "@/lib/subscriptions";
import { FinModelEditor } from "./finmodel-editor";

// Вкладка «Финмодель»: план по сценариям, который можно править, и факт месяца рядом
export async function FinModelView() {
  const now = monthKey(new Date());
  const [saved, deals, bank, subs] = await Promise.all([
    getSetting(FINMODEL_SETTING),
    db.deal.findMany({ select: { amount: true, startDate: true, closedAt: true, stage: { select: { kind: true } } } }),
    db.bankPayment.findMany({ select: { date: true, amount: true }, where: { date: { gte: new Date(Date.now() - 70 * 86_400_000) } } }),
    db.subscription.findMany({
      select: { amount: true, startMonth: true, endMonth: true, active: true, periods: { select: { month: true, amount: true, deal: { select: { stage: { select: { kind: true } } } } } } },
    }),
  ]);
  // Оплаченные месяцы абонементов уже сидят в выручке как сделки; здесь — сколько ещё должно прийти
  const subsFor = (key: string) => {
    const expected = monthlyTotal(subs, key);
    const paid = subs.flatMap((s) => s.periods).filter((p) => p.month === key && p.deal?.stage.kind === "WON").reduce((a, p) => a + p.amount, 0);
    return { expected, waiting: Math.max(0, expected - paid) };
  };
  const stats = monthlyStats(deals.map((d) => ({ ...d, kind: d.stage.kind })));
  const month = (key: string) => ({
    label: monthLabel(key),
    revenue: (stats.get(key) ?? emptyMonth(key)).revenue,
    bank: bank.filter((p) => monthKey(p.date) === key).reduce((a, p) => a + p.amount, 0),
    subs: subsFor(key),
  });

  return (
    <FinModelEditor
      initial={parseFinModel(saved)}
      isNew={!saved}
      fact={{ current: month(now), previous: month(shiftMonth(now, -1)) }}
    />
  );
}
