"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, tempPassword } from "@/lib/auth/password";
import { dropAllSessions, requireOwner } from "@/lib/auth/session";
import { isSection } from "@/lib/auth/sections";

// Результат действия: temp — временный пароль, его директор передаёт сотруднику; показывается один раз
export type EmployeeState = { error?: string; ok?: string; temp?: { name: string; login: string; password: string } } | undefined;

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const LOGIN = /^[a-z0-9._-]{3,40}$/;

// Сотрудник, которым управляет директор; свою карточку директор правит в «Личных данных»
async function staff(id: string) {
  const e = await db.employee.findUnique({ where: { id } });
  if (!e || e.isOwner) throw new Error("Сотрудник не найден");
  return e;
}

async function roleId(raw: FormDataEntryValue | null) {
  const id = text(raw);
  if (!id) return null;
  return (await db.role.findUnique({ where: { id } }))?.id ?? null;
}

export async function createEmployee(_prev: EmployeeState, formData: FormData): Promise<EmployeeState> {
  await requireOwner();
  const name = text(formData.get("name"));
  const login = text(formData.get("login")).toLowerCase();
  if (!name) return { error: "Укажите имя" };
  if (!LOGIN.test(login)) return { error: "Логин: латинские буквы, цифры, точка или дефис, от 3 символов" };
  if (await db.employee.findUnique({ where: { login } })) return { error: `Логин ${login} уже занят` };
  const password = tempPassword();
  await db.employee.create({
    data: {
      name,
      login,
      position: text(formData.get("position")) || null,
      roleId: await roleId(formData.get("roleId")),
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    },
  });
  revalidatePath("/employees");
  return { temp: { name, login, password } };
}

export async function setEmployeeRole(id: string, formData: FormData) {
  await requireOwner();
  await staff(id);
  await db.employee.update({ where: { id }, data: { roleId: await roleId(formData.get("roleId")) } });
  revalidatePath("/employees");
}

// Новый временный пароль: старые входы закрываются, при входе сотрудник придумает свой
export async function resetEmployeePassword(id: string): Promise<EmployeeState> {
  await requireOwner();
  const e = await staff(id);
  const password = tempPassword();
  await db.employee.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null },
  });
  await dropAllSessions(id);
  revalidatePath("/employees");
  return { temp: { name: e.name, login: e.login ?? "", password } };
}

// Потерял телефон с приложением: при следующем входе подключит код заново
export async function resetEmployeeCode(id: string): Promise<EmployeeState> {
  await requireOwner();
  await staff(id);
  await db.employee.update({ where: { id }, data: { totpEnabled: false, totpSecret: null } });
  await dropAllSessions(id);
  revalidatePath("/employees");
  return { ok: "Код сброшен. При входе сотрудник подключит приложение заново." };
}

export async function setEmployeeBlocked(id: string, blocked: boolean) {
  await requireOwner();
  await staff(id);
  await db.employee.update({ where: { id }, data: { blocked, ...(!blocked && { failedLogins: 0, lockedUntil: null }) } });
  if (blocked) await dropAllSessions(id);
  revalidatePath("/employees");
}

export async function deleteEmployee(id: string) {
  await requireOwner();
  await staff(id);
  await db.employee.delete({ where: { id } });
  revalidatePath("/employees");
}

function sectionsFrom(formData: FormData) {
  return formData.getAll("sections").filter((v): v is string => typeof v === "string" && isSection(v));
}

export async function saveRole(id: string | null, _prev: EmployeeState, formData: FormData): Promise<EmployeeState> {
  await requireOwner();
  const name = text(formData.get("name"));
  if (!name) return { error: "Укажите название роли" };
  const clash = await db.role.findUnique({ where: { name } });
  if (clash && clash.id !== id) return { error: `Роль «${name}» уже есть` };
  const sections = sectionsFrom(formData);
  if (id) await db.role.update({ where: { id }, data: { name, sections } });
  else await db.role.create({ data: { name, sections } });
  revalidatePath("/employees");
  return { ok: id ? "Сохранено" : `Роль «${name}» добавлена` };
}

export async function deleteRole(id: string) {
  await requireOwner();
  await db.role.delete({ where: { id } });
  revalidatePath("/employees");
}
