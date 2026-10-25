"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { invalid, optionalEmail, optionalText, parseForm, toErrors, type FormState } from "@/lib/forms";
import { getOwner } from "@/lib/profile";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(100, "Слишком длинное имя"),
  position: optionalText,
  phone: optionalText,
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

  const owner = await getOwner();
  await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: owner.id },
      data: { ...rest, ...(avatar !== "keep" && { avatar: avatar || null }) },
    });
    // Сделки, где владелец был ответственным под старым именем, переходят на новое
    if (owner.name !== rest.name) {
      await tx.deal.updateMany({ where: { owner: owner.name }, data: { owner: rest.name } });
    }
  });
  revalidatePath("/", "layout");
  return { saved: true };
}
