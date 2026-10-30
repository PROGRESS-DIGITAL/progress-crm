"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { invalid, optionalEmail, optionalPhone, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";
import { currentSession, dropAllSessions, requireUser } from "@/lib/auth/session";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(100, "Слишком длинное имя"),
  position: optionalText,
  phone: optionalPhone,
  email: optionalEmail,
  telegram: optionalText,
  max: optionalText,
  vk: optionalText,
  instagram: optionalText,
  whatsapp: optionalText,
  // Пустая строка — удалить фото; "keep" — оставить как есть
  avatar: z
    .string()
    .refine(
      (v) => v === "" || v === "keep" || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
      "Не удалось прочитать фото",
    )
    .refine((v) => v.length < 400_000, "Фото слишком большое"),
});

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(profileSchema, formData);
  if (!parsed.success) return invalid(toErrors(parsed.error), formData);
  const { avatar, ...rest } = parsed.data;

  const owner = await db.employee.findUniqueOrThrow({ where: { id: (await requireUser()).id } });
  await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: owner.id },
      data: { ...rest, ...(avatar !== "keep" && { avatar: avatar || null }) },
    });
    // Сделки, где сотрудник был ответственным под старым именем, переходят на новое
    if (owner.name !== rest.name) {
      await tx.deal.updateMany({ where: { owner: owner.name }, data: { owner: rest.name } });
    }
  });
  revalidatePath("/", "layout");
  return { saved: true };
}

export type PasswordState = { error?: string; ok?: string } | undefined;

// Смена своего пароля: остальные входы и доверенные устройства закрываются, текущий остаётся
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const s = await currentSession();
  if (!s?.session.verified) return { error: "Войдите заново" };
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!(await verifyPassword(current, s.employee.passwordHash))) return { error: "Текущий пароль указан неверно" };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== formData.get("password2")) return { error: "Пароли не совпадают" };
  await db.employee.update({ where: { id: s.employee.id }, data: { passwordHash: await hashPassword(password) } });
  await dropAllSessions(s.employee.id, s.session.id);
  return { ok: "Пароль изменён. На других устройствах нужно войти заново." };
}
