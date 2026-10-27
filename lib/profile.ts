import { db } from "@/lib/db";

// Карточка владельца CRM; создаётся при первом обращении, чтобы шапке всегда было что показать
export async function getOwner() {
  return (
    (await db.employee.findFirst({ where: { isOwner: true } })) ??
    (await db.employee.create({ data: { name: "Владелец CRM", isOwner: true } }))
  );
}

// Кого можно назначить ответственным: владелец первым, потом сотрудники по дате добавления
export async function getEmployeeNames() {
  await getOwner();
  const employees = await db.employee.findMany({ orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }], select: { name: true } });
  return [...new Set(employees.map((e) => e.name))];
}

// Аватары по имени: ответственный в сделке пока хранится строкой
export async function getAvatars() {
  const employees = await db.employee.findMany({ select: { name: true, avatar: true } });
  return Object.fromEntries(employees.filter((e) => e.avatar).map((e) => [e.name, e.avatar!]));
}
