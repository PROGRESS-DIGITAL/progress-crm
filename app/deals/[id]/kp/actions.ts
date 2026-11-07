"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { CLAUDE_MODEL, describeError, getClaude, notConnected } from "@/lib/agents/agent";
import { MAX_LOGO_SIZE } from "@/lib/proposals/store";
import { MAX_TEXT, itemsSchema } from "@/lib/proposals/text";

export type ProposalState = { error?: string; id?: string } | undefined;

// Логотип клиента: только PNG и JPEG, их умеет встраивать PDF
function logoMime(data: Uint8Array) {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  return null;
}

export async function saveProposal(dealId: string, proposalId: string | null, _prev: ProposalState, formData: FormData): Promise<ProposalState> {
  const client = String(formData.get("client") ?? "").trim();
  const period = String(formData.get("period") ?? "").trim();
  const note = String(formData.get("note") ?? "").replace(/\r/g, "").trim();
  if (!client) return { error: "Укажите клиента для обложки" };
  if (client.length > 200) return { error: "Слишком длинное название клиента" };
  if (!period || period.length > 60) return { error: "Укажите месяц и год для обложки" };
  if (note.length > 1000) return { error: "Слишком длинное примечание под итогом" };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Не получилось прочитать услуги, обновите страницу" };
  }
  const parsed = itemsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!parsed.data.length) return { error: "Добавьте в КП хотя бы одну услугу" };

  let logo: { logo: Uint8Array<ArrayBuffer>; logoMime: string } | { logo: null; logoMime: null } | null = null;
  const file = formData.get("logo");
  if (file instanceof File && file.size) {
    if (file.size > MAX_LOGO_SIZE) return { error: "Логотип больше 5 МБ" };
    const data = new Uint8Array(await file.arrayBuffer());
    const mime = logoMime(data);
    if (!mime) return { error: "Логотип нужен в PNG или JPEG" };
    logo = { logo: data, logoMime: mime };
  } else if (formData.get("removeLogo") === "on") {
    logo = { logo: null, logoMime: null };
  }

  const deal = await db.deal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) return { error: "Сделка не найдена" };
  const data = { client, period, note: note || null, items: parsed.data, ...(logo ?? {}) };

  let id = proposalId;
  if (id) {
    const updated = await db.proposal.updateMany({ where: { id, dealId }, data });
    if (!updated.count) return { error: "КП не найдено: возможно, его удалили" };
  } else {
    // Логотип того же клиента из прошлого КП, если новый не загрузили
    if (!logo && formData.get("removeLogo") !== "on" && formData.get("reuseLogo")) {
      const prev = await db.proposal.findUnique({ where: { id: String(formData.get("reuseLogo")) }, select: { logo: true, logoMime: true } });
      if (prev?.logo) logo = { logo: prev.logo, logoMime: prev.logoMime! };
    }
    id = (await db.proposal.create({ data: { ...data, ...(logo ?? {}), dealId } })).id;
  }
  revalidatePath(`/deals/${dealId}`);
  return { id };
}

export async function deleteProposal(dealId: string, id: string) {
  await db.proposal.deleteMany({ where: { id, dealId } });
  revalidatePath(`/deals/${dealId}`);
}

const SYSTEM = `Ты помогаешь веб-студии готовить коммерческое предложение. Тебе дают текст слайда об услуге и данные о клиенте.
Перепиши текст под этого клиента: упомяни его продукты и задачи там, где это уместно, и убери то, что ему явно не подходит.
Сохрани структуру: подзаголовки заканчиваются двоеточием, пункты начинаются с «1.» или «1)» или «•», каждый пункт на своей строке, между блоками пустая строка.
Объём примерно тот же: текст должен поместиться на один слайд. Не придумывай цены, сроки, цифры и факты о клиенте, которых нет в данных.
Если текста нет, напиши его по названию услуги: блок «Этапы работы:» и блок «Состав проекта:».
Пиши по-русски, деловым языком, без markdown. Верни только текст слайда.`;

// Claude подгоняет текст слайда услуги под клиента сделки
export async function adaptSlideText(dealId: string, input: { title: string; text: string; client: string }): Promise<{ text?: string; error?: string }> {
  const claude = await getClaude();
  if (!claude) return { error: notConnected("claude") };
  if (input.text.length > MAX_TEXT || input.title.length > 200 || input.client.length > 200) return { error: "Слишком длинный текст" };
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: { title: true, notes: true, company: { select: { name: true, website: true, notes: true } } },
  });
  if (!deal) return { error: "Сделка не найдена" };
  const facts = [
    `Клиент на обложке КП: ${input.client}`,
    `Компания: ${deal.company.name}`,
    deal.company.website && `Сайт клиента: ${deal.company.website}`,
    deal.company.notes && `Заметки о клиенте: ${deal.company.notes.slice(0, 2000)}`,
    `Сделка: ${deal.title}`,
    deal.notes && `Заметки по сделке: ${deal.notes.slice(0, 2000)}`,
    `Услуга: ${input.title}`,
  ].filter(Boolean);
  try {
    const res = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: `${facts.join("\n")}\n\nТекст слайда:\n${input.text.trim() || "(пусто)"}` }],
    });
    if (res.stop_reason === "refusal") return { error: "Claude не стал переписывать этот текст" };
    const text = res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .replace(/\*\*/g, "")
      .trim();
    if (!text) return { error: "Claude вернул пустой ответ, попробуйте ещё раз" };
    return { text: text.slice(0, MAX_TEXT) };
  } catch (e) {
    return { error: describeError(e) };
  }
}
