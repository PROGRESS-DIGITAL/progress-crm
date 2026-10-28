import type { Channel } from "@prisma/client";
import { db } from "@/lib/db";

// Входящее сообщение в общем виде, одинаковом для всех мессенджеров
export type Incoming = {
  externalId: string;
  name: string;
  username: string | null;
  text: string;
  messageId: string;
  date: Date;
};

const PREVIEW = 120;

function preview(text: string) {
  return text.length > PREVIEW ? `${text.slice(0, PREVIEW - 1)}…` : text;
}

// Входящее сообщение: находим или заводим переписку, повтор того же сообщения не записываем
export async function receiveIncoming(channel: Channel, m: Incoming) {
  const conversation = await db.conversation.upsert({
    where: { channel_externalId: { channel, externalId: m.externalId } },
    update: { name: m.name, username: m.username },
    create: { channel, externalId: m.externalId, name: m.name, username: m.username, lastMessageAt: m.date },
  });
  const dup = await db.chatMessage.findFirst({
    where: { conversationId: conversation.id, direction: "IN", externalId: m.messageId },
    select: { id: true },
  });
  if (dup) return conversation;
  await db.$transaction([
    db.chatMessage.create({
      data: { conversationId: conversation.id, direction: "IN", text: m.text, externalId: m.messageId, createdAt: m.date },
    }),
    db.conversation.update({
      where: { id: conversation.id },
      data: { unread: { increment: 1 }, lastText: preview(m.text), lastMessageAt: m.date },
    }),
  ]);
  return conversation;
}

// Ответ менеджера сбрасывает непрочитанные; ответ AI агента — нет: менеджер всё равно должен увидеть, что писал клиент
export async function recordOutgoing(conversationId: string, text: string, externalId: string, author: string, opts: { keepUnread?: boolean } = {}) {
  await db.$transaction([
    db.chatMessage.create({ data: { conversationId, direction: "OUT", text, externalId, author } }),
    db.conversation.update({
      where: { id: conversationId },
      data: { lastText: preview(text), lastMessageAt: new Date(), ...(opts.keepUnread ? {} : { unread: 0 }) },
    }),
  ]);
}

export async function unreadChats() {
  const r = await db.conversation.aggregate({ _sum: { unread: true } });
  return r._sum.unread ?? 0;
}
