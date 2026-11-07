import { getSetting, setSetting } from "@/lib/settings";
import { notifyOwner } from "@/lib/auth/notify";

// Сообщать директору в Telegram о каждой новой заявке с сайта. По умолчанию включено
export const LEAD_NOTIFY_SETTING = "leads.notifyTelegram";

export async function leadNotifyEnabled() {
  return (await getSetting(LEAD_NOTIFY_SETTING)) !== "off";
}

export async function setLeadNotifyEnabled(on: boolean) {
  await setSetting(LEAD_NOTIFY_SETTING, on ? "on" : "off");
}

type LeadInfo = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
  message?: string | null;
  formName?: string | null;
  pageUrl?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
};

const MESSAGE_LIMIT = 800;

export function newLeadText(lead: LeadInfo, origin: string) {
  const message = lead.message?.trim();
  const utm = [lead.utmSource, lead.utmCampaign].filter(Boolean).join(" / ");
  return [
    "🔔 Новая заявка с сайта",
    lead.name && `Имя: ${lead.name}`,
    lead.phone && `Телефон: ${lead.phone}`,
    lead.email && `Email: ${lead.email}`,
    lead.companyName && `Компания: ${lead.companyName}`,
    lead.formName && `Форма: ${lead.formName}`,
    lead.pageUrl && `Страница: ${lead.pageUrl}`,
    utm && `Реклама: ${utm}`,
    message && `\n${message.length > MESSAGE_LIMIT ? `${message.slice(0, MESSAGE_LIMIT)}…` : message}`,
    `\nОткрыть в CRM: ${origin}/leads/${lead.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Адрес CRM, по которому пришёл запрос: за прокси берём заголовки X-Forwarded-*
export function requestOrigin(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

// Ошибки не пробрасываем: заявка уже сохранена, уведомление не должно её ломать
export async function notifyNewLead(lead: LeadInfo, origin: string) {
  try {
    if (!(await leadNotifyEnabled())) return false;
    return await notifyOwner(newLeadText(lead, origin));
  } catch (e) {
    console.error("Не удалось отправить уведомление о заявке", e);
    return false;
  }
}
