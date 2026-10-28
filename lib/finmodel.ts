import { z } from "zod";

// Финансовая модель студии: несколько сценариев (от минимального до желаемого), по каждому —
// клиенты и средний чек по направлениям, затраты по группам и налог. Выручка, итоги и прибыль считаются
export type FinRow = { id: string; name: string; values: number[] };
export type FinService = { id: string; name: string; clients: number[]; check: number[] };
export type FinGroup = { id: string; title: string; rows: FinRow[] };
export type FinModel = {
  scenarios: string[];
  services: FinService[];
  costs: FinGroup[];
  // Налог в процентах от выручки, одинаковый для всех сценариев
  taxPercent: number;
};

export const FINMODEL_SETTING = "finmodel";
export const MAX_SCENARIOS = 6;

const amount = z.number().finite().min(0).max(1e12);
const values = z.array(amount).max(MAX_SCENARIOS);
export const finModelSchema = z.object({
  scenarios: z.array(z.string().max(60)).min(1).max(MAX_SCENARIOS),
  services: z.array(z.object({ id: z.string().max(40), name: z.string().max(120), clients: values, check: values })).max(50),
  costs: z
    .array(
      z.object({
        id: z.string().max(40),
        title: z.string().max(120),
        rows: z.array(z.object({ id: z.string().max(40), name: z.string().max(120), values })).max(50),
      }),
    )
    .max(20),
  taxPercent: z.number().finite().min(0).max(100),
});

let seq = 0;
export function newId() {
  seq++;
  return `${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const zeros = (n: number) => Array.from({ length: n }, () => 0);

// Шаблон для первого открытия: структура как у типовой финмодели, все суммы нулевые
export function defaultFinModel(): FinModel {
  const n = 4;
  const service = (name: string): FinService => ({ id: newId(), name, clients: zeros(n), check: zeros(n) });
  const row = (name: string): FinRow => ({ id: newId(), name, values: zeros(n) });
  return {
    scenarios: ["Минимальная", "Средняя", "Нормальная", "Желаемая"],
    services: ["Создание сайтов", "SEO", "Брендинг", "Яндекс Директ"].map(service),
    costs: [
      { id: newId(), title: "Зарплаты", rows: [row("Сотрудник 1")] },
      { id: newId(), title: "Инфраструктура", rows: [row("Сервера")] },
      { id: newId(), title: "Маркетинг", rows: [row("Яндекс Директ")] },
      { id: newId(), title: "Прочие затраты", rows: [row("Аренда")] },
    ],
    taxPercent: 0,
  };
}

// Длина массивов значений всегда равна числу сценариев: лишнее отрезаем, недостающее — нули
export function normalizeFinModel(m: FinModel): FinModel {
  const n = m.scenarios.length;
  const fit = (v: number[]) => Array.from({ length: n }, (_, i) => v[i] ?? 0);
  return {
    ...m,
    services: m.services.map((s) => ({ ...s, clients: fit(s.clients), check: fit(s.check) })),
    costs: m.costs.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, values: fit(r.values) })) })),
  };
}

export function parseFinModel(json: string | null): FinModel {
  if (!json) return defaultFinModel();
  try {
    const parsed = finModelSchema.safeParse(JSON.parse(json));
    return parsed.success ? normalizeFinModel(parsed.data) : defaultFinModel();
  } catch {
    return defaultFinModel();
  }
}

export type FinTotals = {
  revenueByService: number[][];
  revenue: number[];
  groupTotals: number[][];
  costs: number[];
  tax: number[];
  profit: number[];
  margin: (number | null)[];
};

export function computeFinModel(m: FinModel): FinTotals {
  const n = m.scenarios.length;
  const sum = (rows: number[][]) => Array.from({ length: n }, (_, i) => rows.reduce((a, r) => a + (r[i] ?? 0), 0));
  const revenueByService = m.services.map((s) => Array.from({ length: n }, (_, i) => (s.clients[i] ?? 0) * (s.check[i] ?? 0)));
  const revenue = sum(revenueByService);
  const groupTotals = m.costs.map((g) => sum(g.rows.map((r) => r.values)));
  const costs = sum(groupTotals);
  const tax = revenue.map((r) => Math.round((r * m.taxPercent) / 100));
  const profit = revenue.map((r, i) => r - costs[i] - tax[i]);
  const margin = revenue.map((r, i) => (r > 0 ? Math.round((profit[i] / r) * 100) : null));
  return { revenueByService, revenue, groupTotals, costs, tax, profit, margin };
}

// Число из ячейки Excel или Google Таблиц: «240 000», «240000,50», «15 000 ₽»; пустая ячейка — null
export function parseNumberCell(cell: string | undefined): number | null {
  const s = (cell ?? "").replace(/[\s ₽]|руб\.?/gi, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const isHeader = (cells: string[], re: RegExp) => cells.some((c) => re.test(c));

// Таблица, скопированная из Excel или Google Таблиц (столбцы через табуляцию), в финмодель.
// Понимает блоки «Кол-во клиентов», «Средний чек», строку сценариев «Выручка | Минимальная | …»,
// «Затраты» с группами (строка без чисел — название группы), строку налога и пропускает «Итого» и «Прибыль»
export function finModelFromTable(text: string): FinModel {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.split("\t").map((c) => c.trim()))
    .filter((cells) => cells.some(Boolean));

  let section: "none" | "clients" | "check" | "revenue" | "costs" | "skip" = "none";
  let scenarios: string[] | null = null;
  let width = 0;
  const services: FinService[] = [];
  const groups: FinGroup[] = [];
  let tax: number[] | null = null;

  const nums = (cells: string[]) => cells.slice(1).map(parseNumberCell);
  const hasNumbers = (cells: string[]) => nums(cells).some((v) => v !== null);
  const service = (name: string) => {
    let s = services.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!s) services.push((s = { id: newId(), name, clients: [], check: [] }));
    return s;
  };

  for (const cells of lines) {
    const name = cells[0];
    if (isHeader(cells, /^кол-?во клиентов|^количество клиентов/i)) {
      section = "clients";
      continue;
    }
    if (/^средний чек/i.test(name)) {
      section = "check";
      continue;
    }
    if (/^выручка/i.test(name)) {
      // «Выручка | Минимальная | Средняя | …» задаёт названия сценариев; «Выручка | 1 | 2 | …» — просто шапка с номерами
      const titles = cells.slice(1).filter(Boolean);
      if (titles.some((t) => parseNumberCell(t) === null)) {
        scenarios = titles;
        section = "revenue";
      }
      continue;
    }
    if (/^затраты|^расходы$/i.test(name) && !hasNumbers(cells)) {
      section = "costs";
      continue;
    }
    if (/^прибыль/i.test(name)) {
      section = "skip";
      continue;
    }
    if (!name || /^итого/i.test(name)) continue;

    const values = nums(cells);
    if (section === "clients" && hasNumbers(cells)) {
      service(name).clients = values.map((v) => v ?? 0);
      width = Math.max(width, values.length);
    } else if (section === "check" && hasNumbers(cells)) {
      service(name).check = values.map((v) => v ?? 0);
      width = Math.max(width, values.length);
    } else if (section === "costs") {
      if (!hasNumbers(cells)) groups.push({ id: newId(), title: name, rows: [] });
      else if (/налог/i.test(name)) tax = values.map((v) => v ?? 0);
      else {
        if (!groups.length) groups.push({ id: newId(), title: "Затраты", rows: [] });
        groups[groups.length - 1].rows.push({ id: newId(), name, values: values.map((v) => v ?? 0) });
        width = Math.max(width, values.length);
      }
    }
  }

  // Столбцы без единого значения в конце строк (хвосты пустых ячеек) не считаем сценариями
  const used = Math.max(
    0,
    ...[...services.flatMap((s) => [s.clients, s.check]), ...groups.flatMap((g) => g.rows.map((r) => r.values))].map(
      (v) => v.reduce((last, x, i) => (x ? i + 1 : last), 0),
    ),
  );
  const n = Math.min(MAX_SCENARIOS, Math.max(1, scenarios?.length ?? (used || width)));
  const names = Array.from({ length: n }, (_, i) => scenarios?.[i] ?? `Сценарий ${i + 1}`);

  const model = normalizeFinModel({
    scenarios: names,
    services,
    costs: groups.filter((g) => g.rows.length),
    taxPercent: 0,
  });
  if (tax) {
    const revenue = computeFinModel(model).revenue;
    const i = revenue.findIndex((r, k) => r > 0 && (tax![k] ?? 0) > 0);
    if (i >= 0) model.taxPercent = Math.round((tax[i] / revenue[i]) * 10000) / 100;
  }
  return model;
}
