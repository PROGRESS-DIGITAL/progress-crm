"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { recordOutgoing } from "@/lib/chat/inbox";
import { NotConnected, sendToChannel } from "@/lib/chat/send";
import { getOwner } from "@/lib/profile";

export type SendState = { error?: string; sentAt?: number } | undefined;

const MAX_TEXT = 4000; // меньший из пределов мессенджеров: Max — 4000, Telegram — 4096

export async function sendChatMessage(conversationId: string, _prev: SendState, formData: FormData): Promise<SendState> {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Напишите сообщение" };
  if (text.length > MAX_TEXT) return { error: `Слишком длинное сообщение: до ${MAX_TEXT} символов` };

  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return { error: "Переписка не найдена" };

  let externalId: string;
  try {
    externalId = await sendToChannel(conversation.channel, conversation.externalId, text);
  } catch (e) {
    if (e instanceof NotConnected) return { error: e.message };
    return { error: `Не отправилось: ${e instanceof Error ? e.message : "ошибка мессенджера"}` };
  }

  const owner = await getOwner();
  await recordOutgoing(conversation.id, text, externalId, owner.name);
  revalidatePath("/chats");
  return { sentAt: Date.now() };
}

// Привязка переписки к клиенту: тогда она видна в карточке клиента
export async function linkCompany(conversationId: string, formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "") || null;
  await db.conversation.update({ where: { id: conversationId }, data: { companyId } });
  revalidatePath("/chats");
  revalidatePath("/clients", "layout");
}
