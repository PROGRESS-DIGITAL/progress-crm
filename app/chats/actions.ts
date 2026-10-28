"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { recordOutgoing } from "@/lib/chat/inbox";
import { NotConnected, sendToChannel } from "@/lib/chat/send";
import { getOwner } from "@/lib/profile";
import { setSetting } from "@/lib/settings";
import { CHAT_AI_SETTING, draftClientReply, getChatAi, type ChatAi } from "@/lib/agents/client-chat";

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

// Какой AI агент отвечает клиентам и включён ли он во всех переписках по умолчанию
export async function saveChatAi(formData: FormData) {
  const agentId = String(formData.get("agentId") ?? "") || null;
  const settings: ChatAi = { agentId, defaultOn: formData.get("defaultOn") === "on" };
  const before = await getChatAi();
  await setSetting(CHAT_AI_SETTING, JSON.stringify(settings));
  // Включили для всех: агент отвечает только на новые сообщения, старые переписки не поднимает
  if (settings.agentId && settings.defaultOn && !(before.agentId && before.defaultOn))
    await db.conversation.updateMany({ where: { aiEnabled: null }, data: { aiCheckedAt: new Date() } });
  revalidatePath("/chats");
}

// Включить или выключить агента в одной переписке; заодно снимает пометку «нужен менеджер»
export async function setConversationAi(conversationId: string, enabled: boolean) {
  await db.conversation.update({
    where: { id: conversationId },
    // Включённый агент отвечает только на новые сообщения, не поднимая старые
    data: { aiEnabled: enabled, aiHandoffAt: null, aiHandoff: null, aiError: null, ...(enabled ? { aiCheckedAt: new Date() } : {}) },
  });
  revalidatePath("/chats");
}

export async function clearHandoff(conversationId: string) {
  await db.conversation.update({ where: { id: conversationId }, data: { aiHandoffAt: null, aiHandoff: null, aiError: null } });
  revalidatePath("/chats");
}

// Черновик ответа от агента: попадает в поле сообщения, менеджер правит и отправляет сам
export async function draftChatReply(conversationId: string) {
  return draftClientReply(conversationId);
}
