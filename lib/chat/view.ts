import type { Channel } from "@prisma/client";
import { db } from "@/lib/db";
import { CHANNEL_LABELS } from "@/lib/chat/channels";
import { connectedChannels } from "@/lib/chat/send";
import { chatVersion } from "@/lib/chat/version";
import { formatChatTime } from "@/lib/format";
import { aiOn, getChatAi, isTyping } from "@/lib/agents/client-chat";
import { CLAUDE_KEY_SETTING } from "@/lib/agents/agent";
import { getSetting } from "@/lib/settings";
import { getRemindChat } from "@/lib/reminders";

const MESSAGES_SHOWN = 300;

export type ChatMessageView = { id: string; direction: "IN" | "OUT"; text: string; time: string; author: string | null };

export type ChatListItem = {
  id: string;
  name: string;
  channel: Channel;
  time: string;
  preview: string;
  unread: number;
  company: string | null;
  typing: boolean;
  handoff: boolean;
  ai: boolean;
};

export type ChatCurrent = {
  id: string;
  name: string;
  channel: Channel;
  username: string | null;
  companyId: string | null;
  ai: boolean;
  typing: boolean;
  handoff: string | null;
  aiError: string | null;
  disabled?: string;
  messages: ChatMessageView[];
};

// Всё, что меняется в «Чатах» без участия менеджера: список переписок и открытая переписка.
// Страница отдаёт это при загрузке, а потом подтягивает свежее из /api/chats/view
export type ChatsView = {
  version: string;
  agentName: string | null;
  aiReady: boolean;
  connected: number;
  list: ChatListItem[];
  current: ChatCurrent | null;
};

export async function loadChatsView(c?: string | null): Promise<ChatsView> {
  const [conversations, connected, ai, claudeKey, remind] = await Promise.all([
    db.conversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      include: { company: { select: { name: true } } },
    }),
    connectedChannels(),
    getChatAi(),
    getSetting(CLAUDE_KEY_SETTING),
    getRemindChat(),
  ]);
  const agent = ai.agentId ? await db.agent.findUnique({ where: { id: ai.agentId }, select: { name: true } }) : null;
  const agentName = agent?.name ?? null;

  const found = c ? conversations.find((x) => x.id === c) : undefined;
  // Открытая переписка считается прочитанной
  if (found?.unread) {
    await db.conversation.update({ where: { id: found.id }, data: { unread: 0 } });
    found.unread = 0;
  }
  const messages = found
    ? await db.chatMessage.findMany({ where: { conversationId: found.id }, orderBy: { createdAt: "desc" }, take: MESSAGES_SHOWN })
    : [];

  const current: ChatCurrent | null = found
    ? {
        id: found.id,
        name: found.name,
        channel: found.channel,
        username: found.username,
        companyId: found.companyId,
        ai: !!agent && aiOn(found, ai, remind?.chatId),
        typing: isTyping(found),
        handoff: found.aiHandoffAt ? (found.aiHandoff ?? "") : null,
        aiError: found.aiError,
        disabled: connected.has(found.channel)
          ? undefined
          : `${CHANNEL_LABELS[found.channel]} не подключён: подключите его в «Интеграциях»`,
        messages: messages.reverse().map((m) => ({
          id: m.id,
          direction: m.direction,
          text: m.text,
          author: m.author,
          time: formatChatTime(m.createdAt),
        })),
      }
    : null;

  return {
    // Отпечаток считаем после пометки «прочитано», иначе следующий опрос сразу увидит изменение
    version: await chatVersion(),
    agentName,
    aiReady: !!agent && !!claudeKey,
    connected: connected.size,
    list: conversations.map((x) => ({
      id: x.id,
      name: x.name,
      channel: x.channel,
      time: formatChatTime(x.lastMessageAt),
      preview: x.lastText ?? "—",
      unread: x.unread,
      company: x.company?.name ?? null,
      typing: isTyping(x),
      handoff: !!x.aiHandoffAt,
      ai: !!agent && aiOn(x, ai, remind?.chatId),
    })),
    current,
  };
}
