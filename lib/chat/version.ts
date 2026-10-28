import { createHash } from "node:crypto";
import { db } from "@/lib/db";

// Отпечаток состояния «Чатов»: меняется, когда пришло или ушло сообщение, агент начал или закончил
// писать, переписку привязали к клиенту. Страница перерисовывается, только когда он изменился
export async function chatVersion() {
  const rows = await db.conversation.findMany({
    orderBy: { id: "asc" },
    select: { id: true, lastMessageAt: true, unread: true, companyId: true, aiEnabled: true, aiTypingAt: true, aiHandoffAt: true, aiError: true },
  });
  return createHash("sha1").update(JSON.stringify(rows)).digest("hex").slice(0, 16);
}
