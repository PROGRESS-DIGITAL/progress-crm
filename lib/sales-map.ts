// Планограмма продаж: с какой ситуации клиент приходит, что ему продать первым и что предложить следом.
// Шаги и стрелки повторяют схему агентства; услуги прайса привязываются к шагам в «Прайсе».

export const SALES_STEPS = {
  research: "Маркетинговое исследование",
  naming: "Нейминг",
  logo: "Разработка логотипа",
  logoPassport: "Паспорт логотипа",
  brandbook: "Брендбук",
  brandPlatform: "Бренд-платформа",
  landing: "Лендинг",
  businessSite: "Бизнес-сайт",
  corporateSite: "Корпоративный сайт",
  shop: "Интернет-магазин",
  service: "Разработка сервиса",
  ai: "Внедрение ИИ",
  promotion: "Продвижение сайта",
  seo: "SEO-продвижение по позициям",
  context: "Контекстная реклама Яндекс Директ",
  productDev: "Продуктовая разработка",
  remoteMarketing: "Удалённый отдел маркетинга",
} as const;

export type SalesStep = keyof typeof SALES_STEPS;

export const STEP_KEYS = Object.keys(SALES_STEPS) as SalesStep[];

export function isSalesStep(value: unknown): value is SalesStep {
  return typeof value === "string" && value in SALES_STEPS;
}

const SITES: SalesStep[] = ["landing", "businessSite", "corporateSite", "shop"];

// Стрелки схемы: после шага слева можно предлагать шаги справа
export const NEXT_STEPS: Record<SalesStep, SalesStep[]> = {
  research: ["naming", "logo"],
  naming: ["logo"],
  logo: ["logoPassport", "brandbook", ...SITES],
  logoPassport: ["brandbook", "brandPlatform"],
  brandbook: ["brandPlatform"],
  brandPlatform: SITES,
  landing: ["promotion"],
  businessSite: ["promotion"],
  corporateSite: ["promotion"],
  shop: ["ai", "promotion"],
  service: ["ai"],
  ai: [],
  promotion: ["context", "seo", "productDev"],
  seo: ["promotion"],
  context: ["promotion"],
  productDev: ["remoteMarketing", "promotion"],
  remoteMarketing: [],
};

export type Situation = "idea" | "noLogo" | "hasLogo" | "hasSite" | "complex";

export type SalesColumn = {
  situation: Situation;
  title: string;
  // Подпись для группы сайтов: для клиента с сайтом это уже «Переделка сайта»
  siteGroup?: string;
  steps: SalesStep[];
};

export const SALES_COLUMNS: SalesColumn[] = [
  { situation: "idea", title: "Нет ничего, только идея", steps: ["research", "naming"] },
  { situation: "noLogo", title: "Нет логотипа", steps: ["logo", "logoPassport", "brandbook", "brandPlatform"] },
  { situation: "hasLogo", title: "Есть логотип", siteGroup: "Разработка сайта", steps: [...SITES, "ai"] },
  { situation: "hasSite", title: "Есть логотип и сайт", siteGroup: "Переделка сайта", steps: [...SITES, "ai"] },
  { situation: "complex", title: "Нужен сложный сайт или сервис", steps: ["service", "ai"] },
];

// Общий блок продвижения под колонками сайтов
export const GROWTH_STEPS: SalesStep[] = ["promotion", "seo", "context", "productDev", "remoteMarketing"];

export const SITUATION_LABELS = Object.fromEntries(SALES_COLUMNS.map((c) => [c.situation, c.title])) as Record<
  Situation,
  string
>;

export function isSituation(value: unknown): value is Situation {
  return typeof value === "string" && value in SITUATION_LABELS;
}

// Ситуацию менеджер может указать сам; иначе понимаем её по тому, что клиент уже купил
export function inferSituation(done: Set<SalesStep>, manual?: string | null): Situation {
  if (isSituation(manual)) return manual;
  if (done.has("service")) return "complex";
  if (SITES.some((s) => done.has(s))) return "hasSite";
  if (done.has("logo") || done.has("logoPassport") || done.has("brandbook")) return "hasLogo";
  return "idea";
}

export type ClientPlan = {
  situation: Situation;
  done: SalesStep[];
  inProgress: SalesStep[];
  // Что предложить следующим, в порядке схемы
  next: SalesStep[];
};

export function clientPlan(
  deals: { step: SalesStep | null; kind: "OPEN" | "WON" | "LOST" }[],
  manualSituation?: string | null,
): ClientPlan {
  const done = new Set<SalesStep>();
  const inProgress = new Set<SalesStep>();
  for (const d of deals) {
    if (!d.step) continue;
    if (d.kind === "WON") done.add(d.step);
    else if (d.kind === "OPEN") inProgress.add(d.step);
  }
  const situation = inferSituation(done, manualSituation);

  const candidates = new Set<SalesStep>();
  for (const step of done) NEXT_STEPS[step].forEach((s) => candidates.add(s));
  // Пока ничего не куплено, предлагаем первые шаги колонки клиента
  if (done.size === 0) {
    const column = SALES_COLUMNS.find((c) => c.situation === situation)!;
    column.steps.slice(0, situation === "hasLogo" || situation === "hasSite" ? 4 : 2).forEach((s) => candidates.add(s));
  }
  const next = STEP_KEYS.filter((s) => candidates.has(s) && !done.has(s) && !inProgress.has(s));

  return {
    situation,
    done: STEP_KEYS.filter((s) => done.has(s)),
    inProgress: STEP_KEYS.filter((s) => inProgress.has(s) && !done.has(s)),
    next,
  };
}
