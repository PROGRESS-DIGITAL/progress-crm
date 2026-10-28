"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/lib/settings";
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
