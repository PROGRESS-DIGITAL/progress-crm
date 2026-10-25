import type { Channel } from "@prisma/client";

export const CHANNEL_LABELS: Record<Channel, string> = {
  TELEGRAM: "Telegram",
  VK: "VK",
  MAX: "Max",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
};

// Цвет значка канала в списке чатов
export const CHANNEL_COLORS: Record<Channel, string> = {
  TELEGRAM: "bg-sky-500",
  VK: "bg-blue-600",
  MAX: "bg-violet-500",
  WHATSAPP: "bg-emerald-500",
  INSTAGRAM: "bg-pink-500",
};
