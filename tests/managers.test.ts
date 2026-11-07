import { test } from "node:test";
import assert from "node:assert/strict";
import { managerReport, parsePlans, planFor, setPlan, NO_OWNER, type ManagerDeal } from "../lib/managers";

// Полдень по Москве, чтобы дата точно попала в нужный месяц
const at = (day: string) => new Date(`${day}T12:00:00+03:00`);

function deal(owner: string | null, kind: ManagerDeal["kind"], amount: number, start: string, closed?: string, expected?: string): ManagerDeal {
  return {
    owner,
    kind,
    amount,
    startDate: at(start),
    closedAt: closed ? at(closed) : null,
    expectedCloseDate: expected ? at(expected) : null,
  };
}

test("план переносится на следующие месяцы, пока его не поменяют", () => {
  let plans = setPlan({}, "Анна Петрова", "2026-09", 300_000);
  plans = setPlan(plans, "Анна Петрова", "2026-11", 400_000);
  assert.equal(planFor(plans, "Анна Петрова", "2026-08"), 0);
  assert.equal(planFor(plans, "Анна Петрова", "2026-09"), 300_000);
  assert.equal(planFor(plans, "Анна Петрова", "2026-10"), 300_000);
  assert.equal(planFor(plans, "Анна Петрова", "2027-02"), 400_000);
  assert.equal(planFor(plans, "Борис Иванов", "2026-11"), 0);
});

test("ноль снимает план с этого месяца, а без раннего плана не хранится", () => {
  let plans = setPlan({}, "Анна Петрова", "2026-09", 300_000);
  plans = setPlan(plans, "Анна Петрова", "2026-12", 0);
  assert.equal(planFor(plans, "Анна Петрова", "2026-11"), 300_000);
  assert.equal(planFor(plans, "Анна Петрова", "2027-01"), 0);
  assert.deepEqual(setPlan({}, "Борис Иванов", "2026-11", 0), {});
});

test("из настройки читаются только корректные планы", () => {
  assert.deepEqual(parsePlans(null), {});
  assert.deepEqual(parsePlans("не json"), {});
  assert.deepEqual(parsePlans(JSON.stringify({ "Анна Петрова": { "2026-11": 500_000, "2026-13": 1, x: 2, "2026-12": -5 }, Пусто: {} })), {
    "Анна Петрова": { "2026-11": 500_000 },
  });
});

test("выручка, конверсия и выполнение плана по менеджерам", () => {
  const plans = setPlan({}, "Анна Петрова", "2026-10", 500_000);
  const { rows, total } = managerReport(
    [
      deal("Анна Петрова", "WON", 300_000, "2026-10-01", "2026-11-05"),
      deal("Анна Петрова", "WON", 100_000, "2026-11-02", "2026-11-20"),
      deal("Анна Петрова", "LOST", 80_000, "2026-11-03", "2026-11-10"),
      deal("Анна Петрова", "OPEN", 200_000, "2026-11-04", undefined, "2026-11-28"),
      deal("Анна Петрова", "OPEN", 50_000, "2026-09-04", undefined, "2026-12-15"),
      // Оплачено в прошлом месяце: в ноябрь не попадает
      deal("Анна Петрова", "WON", 999_000, "2026-09-01", "2026-10-30"),
      deal("Борис Иванов", "WON", 600_000, "2026-11-01", "2026-11-15"),
      deal(" ", "OPEN", 10_000, "2026-11-06"),
    ],
    "2026-11",
    plans,
    "2026-11",
  );
  assert.deepEqual(
    rows.map((r) => r.owner),
    ["Борис Иванов", "Анна Петрова", NO_OWNER],
  );
  const anna = rows[1];
  assert.equal(anna.plan, 500_000);
  assert.equal(anna.revenue, 400_000);
  assert.equal(anna.progress, 80);
  assert.equal(anna.won, 2);
  assert.equal(anna.lost, 1);
  assert.equal(anna.winRate, 67);
  assert.equal(anna.avgCheck, 200_000);
  assert.equal(anna.started, 3);
  assert.equal(anna.open, 2);
  assert.equal(anna.openSum, 250_000);
  assert.equal(anna.expected, 1);
  assert.equal(anna.expectedSum, 200_000);

  const boris = rows[0];
  assert.equal(boris.progress, null);
  assert.equal(boris.winRate, 100);

  assert.equal(total.revenue, 1_000_000);
  assert.equal(total.plan, 500_000);
  assert.equal(total.won, 3);
  assert.equal(total.winRate, 75);
  assert.equal(total.open, 3);
});

test("менеджер с планом виден, даже если сделок ещё нет; прошлый месяц без открытых сделок", () => {
  const plans = setPlan({}, "Вера Смирнова", "2026-11", 200_000);
  const deals = [deal("Анна Петрова", "OPEN", 100_000, "2026-08-01"), deal("Анна Петрова", "WON", 50_000, "2026-09-01", "2026-10-03")];

  const now = managerReport(deals, "2026-11", plans, "2026-11");
  assert.deepEqual(
    now.rows.map((r) => [r.owner, r.plan, r.open]),
    [
      ["Вера Смирнова", 200_000, 0],
      ["Анна Петрова", 0, 1],
    ],
  );
  assert.equal(now.rows[0].progress, 0);

  const past = managerReport(deals, "2026-10", plans, "2026-11");
  assert.deepEqual(
    past.rows.map((r) => [r.owner, r.revenue, r.open]),
    [["Анна Петрова", 50_000, 0]],
  );
});
