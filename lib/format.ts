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

const DAY = 86_400_000;
const MSK_OFFSET = 3 * 3_600_000; // Москва без перехода на летнее время

// «Время в CRM»: сколько сегодня CRM была открыта на экране. Счёт копится в браузере и в 00:00 по Москве начинается заново
export type CrmTime = { day: string; total: number; last: number };

// Паузу дольше 5 секунд не считаем: CRM была закрыта или вкладка скрыта. Несколько вкладок не удваивают время,
// потому что каждая добавляет только промежуток с последней отметки любой из них
export const CRM_TIME_GAP = 5_000;

export function moscowDayKey(now: number) {
  return new Date(now + MSK_OFFSET).toISOString().slice(0, 10);
}

export function addCrmTime(prev: CrmTime | null, now: number): CrmTime {
  const day = moscowDayKey(now);
  if (!prev || prev.day !== day) {
    const midnight = Math.floor((now + MSK_OFFSET) / DAY) * DAY - MSK_OFFSET;
    // Вкладка была открыта в полночь: новый день считаем с 00:00
    const carried = prev && now - prev.last < CRM_TIME_GAP ? now - midnight : 0;
    return { day, total: carried, last: now };
  }
  const delta = now - prev.last;
  return { day, total: prev.total + (delta > 0 && delta < CRM_TIME_GAP ? delta : 0), last: Math.max(now, prev.last) };
}

export function formatCrmTime(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
