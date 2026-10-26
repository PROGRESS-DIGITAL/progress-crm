import { db } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/settings";
import { dayKey, fromKey, minutesOfDay, timeLabel } from "@/lib/calendar";
export { DEFAULT_REMIND, REMIND_OPTIONS } from "@/lib/calendar";
import { sendTelegram, TELEGRAM_TOKEN_SETTING } from "@/lib/chat/telegram";

// Напоминания приходят владельцу CRM от того же Telegram-бота, через который пишут клиенты.
// Бот не может написать первым, поэтому владелец один раз открывает ссылку t.me/<бот>?start=crm-<код>
export const REMIND_CHAT_SETTING = "reminders.telegramChat";
export const REMIND_CODE_SETTING = "reminders.code";

export type RemindChat = { chatId: string; name: string };

// Событие на весь день напоминает в 9:00 по Москве в свой день, а «за 1 день» — в 9:00 накануне
const ALL_DAY_AT = 9 * 60;

type Remindable = { start: Date; allDay: boolean; remindMinutes: number | null };

export function remindAt(e: Remindable) {
  if (e.remindMinutes === null) return null;
  if (e.allDay) return fromKey(dayKey(e.start), ALL_DAY_AT - (e.remindMinutes >= 1440 ? 1440 : 0));
  return new Date(e.start.getTime() - e.remindMinutes * 60_000);
}

export function linkCode(text: string | undefined) {
  return text?.match(/^\/start crm-([a-z0-9]{6,})$/)?.[1] ?? null;
}

const dateLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", timeZone: "Europe/Moscow" });

function lead(e: Remindable, now: Date) {
  if (e.allDay) return dayKey(e.start) === dayKey(now) ? "Сегодня" : "Завтра";
  const left = Math.round((e.start.getTime() - now.getTime()) / 60_000);
  if (left <= 1) return "Сейчас";
  if (left < 60) return `Через ${left} мин`;
  if (left < 1440) {
    const h = Math.floor(left / 60);
    const m = left % 60;
    return `Через ${h} ч${m ? ` ${m} мин` : ""}`;
  }
  return "Завтра";
}

export function reminderText(
  e: Remindable & { kind: "MEETING" | "TASK"; title: string; end: Date; notes: string | null },
  links: { company?: string | null; deal?: string | null },
  now = new Date(),
) {
  const what = e.kind === "TASK" ? `задача «${e.title}»` : e.title;
  const when = e.allDay
    ? dateLabel.format(e.start)
    : `${dateLabel.format(e.start)}, ${timeLabel(minutesOfDay(e.start))}–${timeLabel(minutesOfDay(e.end))}`;
  return [
    `⏰ ${lead(e, now)}: ${what}`,
    when,
    links.company && `Клиент: ${links.company}`,
    links.deal && `Сделка: ${links.deal}`,
    e.notes && `\n${e.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function getRemindChat() {
  const raw = await getSetting(REMIND_CHAT_SETTING);
  return raw ? (JSON.parse(raw) as RemindChat) : null;
}

export async function getRemindCode() {
  const saved = await getSetting(REMIND_CODE_SETTING);
  if (saved) return saved;
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await setSetting(REMIND_CODE_SETTING, code);
  return code;
}

// Раз в минуту: отправить напоминания, время которых пришло, пока событие ещё не закончилось
export async function sendDueReminders(now = new Date()) {
  const [token, chat] = await Promise.all([getSetting(TELEGRAM_TOKEN_SETTING), getRemindChat()]);
  if (!token || !chat) return 0;
  const candidates = await db.event.findMany({
    where: {
      remindMinutes: { not: null },
      remindedAt: null,
      done: false,
      end: { gt: now },
      start: { lte: new Date(now.getTime() + 2 * 86_400_000) },
    },
    include: { company: { select: { name: true } }, deal: { select: { title: true } } },
    orderBy: { start: "asc" },
  });
  let sent = 0;
  for (const e of candidates) {
    const at = remindAt(e);
    if (!at || at > now) continue;
    await sendTelegram(token, chat.chatId, reminderText(e, { company: e.company?.name, deal: e.deal?.title }, now));
    await db.event.update({ where: { id: e.id }, data: { remindedAt: now } });
    sent++;
  }
  return sent;
}

// Владелец открыл ссылку из CRM и нажал «Старт»: запоминаем его чат для напоминаний.
// true — сообщение служебное, в «Чаты» его не кладём
export async function linkReminderChat(token: string, m: { externalId: string; name: string; text: string }) {
  const code = linkCode(m.text);
  if (!code) return false;
  if (code !== (await getSetting(REMIND_CODE_SETTING))) return false;
  await setSetting(REMIND_CHAT_SETTING, JSON.stringify({ chatId: m.externalId, name: m.name } satisfies RemindChat));
  await sendTelegram(token, m.externalId, "Готово: сюда будут приходить напоминания о встречах и задачах из календаря CRM.");
  return true;
}
