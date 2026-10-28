import type { LeadSource, LeadStatus, Service } from "@prisma/client";

export const SERVICE_LABELS: Record<Service, string> = {
  WEBSITE: "Сайт",
  SEO: "SEO",
  CONTEXT_ADS: "Директ",
  BRANDING: "Брендинг",
  SMM: "SMM",
  OTHER: "Другое",
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatRub(amount: number) {
  return rub.format(amount);
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Новый",
  IN_PROGRESS: "В работе",
  CONVERTED: "Сделка",
  REJECTED: "Отклонён",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  TILDA: "Тильда",
  MANUAL: "Вручную",
  CHAT: "Из чата",
};

export const LEAD_STATUS_BADGE: Record<LeadStatus, string> = {
  NEW: "bg-amber-50 text-amber-800",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  CONVERTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-slate-100 text-slate-600",
};

// Сервер может работать в UTC, а команда смотрит время по Москве
export const TIME_ZONE = "Europe/Moscow";

export function formatDateTime(d: Date) {
  return d.toLocaleString("ru-RU", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const CATEGORY_ORDER = ["Сайты", "Брендинг", "Издания"];

export function sortByCategory<T extends { category: string; sortOrder: number }>(items: T[]) {
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...items].sort(
    (a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder,
  );
}

export function formatPrice(p: { price: number; unit: string | null }) {
  return `${formatRub(p.price)}${p.unit ? `/${p.unit}` : ""}`;
}

// Время в списке чатов: сегодня — часы, иначе дата
export function formatChatTime(d: Date, now = new Date()) {
  const day = (x: Date) => x.toLocaleDateString("ru-RU", { timeZone: TIME_ZONE });
  if (day(d) === day(now)) {
    return d.toLocaleTimeString("ru-RU", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ru-RU", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
}
