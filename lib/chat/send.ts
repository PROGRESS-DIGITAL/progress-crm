import type { Channel } from "@prisma/client";
import { CHANNEL_LABELS } from "./channels";
import { MAX_TOKEN_SETTING, sendMax } from "./max";
import { getSetting } from "@/lib/settings";
import { sendTelegram, sendTelegramTyping, TELEGRAM_TOKEN_SETTING } from "./telegram";
import { sendVk, sendVkTyping, VK_TOKEN_SETTING } from "./vk";

type Sender = {
  setting: string;
  send: (token: string, to: string, text: string) => Promise<string>;
  // Max по id пользователя «печатает…» показать не даёт: для этого нужен id диалога
  typing?: (token: string, to: string) => Promise<void>;
};

const SENDERS: Partial<Record<Channel, Sender>> = {
  TELEGRAM: { setting: TELEGRAM_TOKEN_SETTING, send: sendTelegram, typing: sendTelegramTyping },
  MAX: { setting: MAX_TOKEN_SETTING, send: sendMax },
  VK: { setting: VK_TOKEN_SETTING, send: sendVk, typing: sendVkTyping },
};

// Каналы, для которых в «Интеграциях» сохранён ключ
export async function connectedChannels() {
  const entries = await Promise.all(
    Object.entries(SENDERS).map(async ([ch, s]) => [ch, !!(await getSetting(s!.setting))] as const),
  );
  return new Set(entries.filter(([, on]) => on).map(([ch]) => ch as Channel));
}

export class NotConnected extends Error {}

export async function sendToChannel(channel: Channel, to: string, text: string) {
  const sender = SENDERS[channel];
  const token = sender && (await getSetting(sender.setting));
  if (!sender || !token) throw new NotConnected(`${CHANNEL_LABELS[channel]} не подключён: подключите его в «Интеграциях»`);
  return sender.send(token, to, text);
}

// «Печатает…» у клиента, пока агент пишет ответ. Не получилось — не страшно, ответ всё равно уйдёт
export async function sendTyping(channel: Channel, to: string) {
  const sender = SENDERS[channel];
  const token = sender?.typing && (await getSetting(sender.setting));
  if (token) await sender.typing!(token, to).catch(() => undefined);
}
