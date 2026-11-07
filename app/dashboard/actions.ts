"use server";

import { revalidatePath } from "next/cache";
import { getSetting, setSetting } from "@/lib/settings";
import { MAX_PLAN, NO_OWNER, PLAN_SETTING, isMonthKey, parsePlans, setPlan } from "@/lib/managers";
import { FINMODEL_SETTING, finModelFromTable, finModelSchema, normalizeFinModel, type FinModel } from "@/lib/finmodel";
import { xlsxFirstSheetAsTable } from "@/lib/xlsx-table";

export async function saveFinModel(model: FinModel): Promise<{ error?: string }> {
  const parsed = finModelSchema.safeParse(model);
  if (!parsed.success) return { error: "Не получилось сохранить: проверьте, что в ячейках только числа" };
  await setSetting(FINMODEL_SETTING, JSON.stringify(normalizeFinModel(parsed.data)));
  revalidatePath("/dashboard");
  return {};
}

// Файл Excel в финмодель: возвращается на проверку, сохраняет её сам пользователь кнопкой «Сохранить»
export async function readFinModelFile(formData: FormData): Promise<{ model?: FinModel; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Выберите файл .xlsx" };
  if (file.size > 5 * 1024 * 1024) return { error: "Файл больше 5 МБ: это точно финмодель?" };
  try {
    const model = finModelFromTable(await xlsxFirstSheetAsTable(await file.arrayBuffer()));
    if (!model.services.length && !model.costs.length) return { error: "В файле не нашлось блоков «Кол-во клиентов», «Средний чек» или «Затраты»" };
    return { model };
  } catch {
    return { error: "Не получилось прочитать файл. Нужен .xlsx из Excel или Google Таблиц" };
  }
}

// План менеджера на месяц: действует с этого месяца и дальше, пока его не поменяют. Пустая сумма или 0 снимает план
export async function saveManagerPlan(_prev: unknown, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const owner = String(formData.get("owner") ?? "").trim();
  const month = formData.get("month");
  const raw = String(formData.get("amount") ?? "").replace(/[\s\u00a0₽]/g, "");
  const amount = raw === "" ? 0 : Number(raw);
  if (!owner || owner === NO_OWNER || owner.length > 200) return { error: "Выберите менеджера" };
  if (!isMonthKey(month)) return { error: "Неверный месяц" };
  if (!Number.isInteger(amount) || amount < 0) return { error: "Введите сумму в целых рублях" };
  if (amount > MAX_PLAN) return { error: "Слишком большая сумма" };
  const plans = parsePlans(await getSetting(PLAN_SETTING));
  await setSetting(PLAN_SETTING, JSON.stringify(setPlan(plans, owner, month, amount)));
  revalidatePath("/dashboard");
  return { ok: true };
}
