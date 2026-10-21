import type { Service } from "@prisma/client";

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
