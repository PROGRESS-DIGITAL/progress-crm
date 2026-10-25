import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const MERGE_FIELDS = [
  "name",
  "inn",
  "kpp",
  "ogrn",
  "director",
  "website",
  "phone",
  "email",
  "address",
  "situation",
  "notes",
] as const;

type Fields = Partial<Record<(typeof MERGE_FIELDS)[number], string | null>>;

// Объединение данных: у основного клиента заполненное не трогаем, пустое берём у второго; заметки складываем
export function mergeFields(target: Fields, source: Fields): Omit<Fields, "name"> & { name?: string } {
  const result: Fields = {};
  for (const key of MERGE_FIELDS) {
    const a = target[key]?.trim() || null;
    const b = source[key]?.trim() || null;
    if (key === "notes" && a && b && a !== b) result.notes = `${a}\n\n${b}`;
    else result[key] = a ?? b;
  }
  // Название у клиента обязательно: пустым оно не станет
  return { ...result, name: result.name ?? undefined };
}

export type Duplicate = { id: string; name: string; inn: string | null; reason: "inn" | "name" };

// Дубль: тот же ИНН или то же название без учёта регистра и пробелов по краям
export async function findDuplicate(data: { name: string; inn: string | null }, excludeId?: string) {
  const or: Prisma.CompanyWhereInput[] = [{ name: { equals: data.name.trim(), mode: "insensitive" } }];
  if (data.inn) or.unshift({ inn: data.inn });
  const found = await db.company.findMany({
    where: { OR: or, ...(excludeId && { id: { not: excludeId } }) },
    select: { id: true, name: true, inn: true },
    take: 5,
  });
  // Совпадение по ИНН надёжнее, показываем его первым
  const byInn = data.inn ? found.find((c) => c.inn === data.inn) : undefined;
  const hit = byInn ?? found[0];
  if (!hit) return null;
  return { ...hit, reason: byInn ? "inn" : "name" } satisfies Duplicate;
}

// Переносит сделки и контакты второго клиента к основному и удаляет второго
export async function mergeCompanies(targetId: string, sourceId: string, incoming?: Fields) {
  await db.$transaction(async (tx) => {
    const [target, source] = await Promise.all([
      tx.company.findUniqueOrThrow({ where: { id: targetId } }),
      tx.company.findUniqueOrThrow({ where: { id: sourceId } }),
    ]);
    // incoming — то, что менеджер только что ввёл в форму основного клиента: оно важнее старых данных
    const base = incoming ? mergeFields(incoming, target) : target;
    await tx.deal.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
    await tx.contact.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
    await tx.company.delete({ where: { id: sourceId } });
    await tx.company.update({ where: { id: targetId }, data: mergeFields(base, source) });
  });
}
