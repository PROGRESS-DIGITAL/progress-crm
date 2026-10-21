import type { LeadStatus, Service } from "@prisma/client";

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
