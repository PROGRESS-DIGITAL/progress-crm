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

// Схема идёт по нарастающей: идея → логотип → сайт → сложный сервис
const LADDER: Situation[] = ["idea", "noLogo", "hasLogo", "hasSite", "complex"];
const BRAND: SalesStep[] = ["logo", "logoPassport", "brandbook", "brandPlatform"];

// Что предлагаем клиенту в его ситуации, ещё до первой покупки
export const SITUATION_OFFERS: Record<Situation, SalesStep[]> = {
  idea: ["research", "naming"],
  noLogo: ["research", "naming", "logo"],
  hasLogo: ["logoPassport", "brandbook", "brandPlatform", ...SITES, "ai"],
  // С сайтом — переделка сайта, продвижение, ИИ и сервис
  hasSite: [...SITES, "promotion", "seo", "context", "ai", "service"],
  complex: ["service", "ai"],
};

// Что левее ситуации клиента, ему уже не предлагаем: с сайтом логотип и брендинг скорее всего есть.
// Продать их всё равно можно, сделка по такому шагу посчитается в ✓ и ◷
const BEHIND: Record<Situation, SalesStep[]> = {
  idea: [],
  noLogo: [],
  hasLogo: ["research", "naming", "logo"],
  hasSite: ["research", "naming", ...BRAND],
  complex: ["research", "naming", ...BRAND, ...SITES],
};

// Ситуация по покупкам; указанная менеджером ситуация важнее, если она не отстаёт от покупок
export function inferSituation(done: Set<SalesStep>, manual?: string | null): Situation {
  let bought: Situation = "idea";
  if (done.has("service")) bought = "complex";
  else if (SITES.some((s) => done.has(s))) bought = "hasSite";
  else if (BRAND.some((s) => done.has(s))) bought = "hasLogo";
  if (!isSituation(manual)) return bought;
  return LADDER.indexOf(manual) >= LADDER.indexOf(bought) ? manual : bought;
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

  const candidates = new Set<SalesStep>(SITUATION_OFFERS[situation]);
  for (const step of done) NEXT_STEPS[step].forEach((s) => candidates.add(s));
  for (const s of BEHIND[situation]) candidates.delete(s);
  // Сайт клиенту уже сделали мы: другой сайт следом не предлагаем
  if (SITES.some((s) => done.has(s))) for (const s of SITES) candidates.delete(s);
  const next = STEP_KEYS.filter((s) => candidates.has(s) && !done.has(s) && !inProgress.has(s));

  return {
    situation,
    done: STEP_KEYS.filter((s) => done.has(s)),
    inProgress: STEP_KEYS.filter((s) => inProgress.has(s) && !done.has(s)),
    next,
  };
}
