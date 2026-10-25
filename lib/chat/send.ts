import type { Channel } from "@prisma/client";
import { CHANNEL_LABELS } from "./channels";
import { MAX_TOKEN_SETTING, sendMax } from "./max";
import { getSetting } from "./settings";
import { sendTelegram, TELEGRAM_TOKEN_SETTING } from "./telegram";
import { sendVk, VK_TOKEN_SETTING } from "./vk";

const SENDERS: Partial<Record<Channel, { setting: string; send: (token: string, to: string, text: string) => Promise<string> }>> = {
  TELEGRAM: { setting: TELEGRAM_TOKEN_SETTING, send: sendTelegram },
  MAX: { setting: MAX_TOKEN_SETTING, send: sendMax },
  VK: { setting: VK_TOKEN_SETTING, send: sendVk },
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
