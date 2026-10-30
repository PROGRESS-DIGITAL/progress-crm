"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { askAgent, chatTitle } from "@/lib/agents/agent";
import { isScope } from "@/lib/agents/tools";
import { normalizeWebsite } from "@/lib/agents/website";
import { agentScopesFor } from "@/lib/agents/tools";
import { requireOwner, requireUser } from "@/lib/auth/session";

// Чаты сотрудника — только его; директор видит и свои старые чаты, созданные до появления входа
function ownChats(user: { id: string; isOwner: boolean }) {
  return user.isOwner ? { OR: [{ employeeId: user.id }, { employeeId: null }] } : { employeeId: user.id };
}

export type AskState = { ok: true; chatId: string } | { ok: false; error: string };

// Вопрос агенту. История чата уходит модели как есть, новые шаги сохраняются только вместе с ответом:
// если Claude не ответил, в чате не остаётся оборванных запросов к данным
export async function askAgentAction(agentId: string, chatId: string | null, question: string): Promise<AskState> {
  const text = question.trim();
  if (!text) return { ok: false, error: "Напишите вопрос" };
  if (text.length > 4000) return { ok: false, error: "Вопрос слишком длинный: до 4000 символов" };

  const user = await requireUser();
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) return { ok: false, error: "Агент не найден" };
  const chat = chatId ? await db.agentChat.findFirst({ where: { id: chatId, agentId, ...ownChats(user) } }) : null;
  if (chatId && !chat) return { ok: false, error: "Чат не найден" };

  const history = chat
    ? (await db.agentMessage.findMany({ where: { chatId: chat.id }, orderBy: { seq: "asc" }, select: { role: true, content: true } })).map(
        (m) => ({ role: m.role, content: m.content }) as Anthropic.Beta.BetaMessageParam,
      )
    : [];

  // Агент работает только с теми разделами, которые открыты сотруднику: директор видит всё
  const result = await askAgent({ ...agent, scopes: agentScopesFor(agent.scopes, user.sections) }, history, text);
  if (!result.ok) return result;

  const id = chat?.id ?? (await db.agentChat.create({ data: { agentId, employeeId: user.id, title: chatTitle(text) } })).id;
  // По одному insert на шаг, чтобы порядковые номера шли строго по порядку
  await db.$transaction([
    ...result.steps.map((s) =>
      db.agentMessage.create({
        data: { chatId: id, role: s.role, content: s.content as unknown as Prisma.InputJsonValue, text: s.text, sources: s.sources },
      }),
    ),
    db.agentChat.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);
  revalidatePath(`/agents/${agentId}`);
  return { ok: true, chatId: id };
}

export async function deleteAgentChat(chatId: string) {
  const user = await requireUser();
  const own = await db.agentChat.findFirst({ where: { id: chatId, ...ownChats(user) } });
  if (!own) throw new Error("Чат не найден");
  const chat = await db.agentChat.delete({ where: { id: own.id } });
  revalidatePath(`/agents/${chat.agentId}`);
  redirect(`/agents/${chat.agentId}`);
}

const agentSchema = z.object({
  name: z.string().trim().min(1, "Назовите агента").max(60),
  description: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(8000),
});

export type AgentFormState = { error?: string } | undefined;

export async function saveAgent(id: string | null, _prev: AgentFormState, formData: FormData): Promise<AgentFormState> {
  await requireOwner();
  const parsed = agentSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    instructions: formData.get("instructions") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const scopes = formData.getAll("scopes").map(String).filter(isScope);
  if (!scopes.length) return { error: "Отметьте хотя бы один раздел, иначе агенту не с чем работать" };

  const website = normalizeWebsite(String(formData.get("website") ?? ""));
  if (website === undefined) return { error: "Проверьте адрес сайта: например, progrs.ru или https://progrs.ru/uslugi" };

  const data = { ...parsed.data, description: parsed.data.description || null, website, scopes };
  const agent = id ? await db.agent.update({ where: { id }, data }) : await db.agent.create({ data });
  revalidatePath("/agents", "layout");
  redirect(`/agents/${agent.id}`);
}

// Постоянного агента удалить нельзя: раздел всегда открывается с него
export async function deleteAgent(id: string) {
  await requireOwner();
  await db.agent.deleteMany({ where: { id, isDefault: false } });
  revalidatePath("/agents", "layout");
  redirect("/agents");
}
