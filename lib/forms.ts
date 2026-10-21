import { z } from "zod";

export type FormState =
  | {
      errors?: Record<string, string>;
      // Введённые значения: React сбрасывает форму после отправки, и без них при ошибке ввод пропадёт
      values?: Record<string, string>;
      saved?: boolean;
    }
  | undefined;

// Пустая строка из формы превращается в null, чтобы не хранить "" в базе
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const optionalEmail = optionalText.refine(
  (v) => v === null || z.string().email().safeParse(v).success,
  "Некорректный email",
);

export function parseForm<T extends z.ZodRawShape>(schema: z.ZodObject<T>, formData: FormData) {
  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, formData.get(k) ?? null]));
  return schema.safeParse(raw);
}

export function toErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    errors[key] ??= issue.message;
  }
  return errors;
}

export function invalid(errors: Record<string, string>, formData: FormData): FormState {
  const values: Record<string, string> = {};
  formData.forEach((v, k) => {
    if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  });
  return { errors, values };
}

// Значение поля для defaultValue: сначала то, что ввёл пользователь, потом сохранённое
export function fieldValue(state: FormState, initial: object | undefined, name: string): string {
  const typed = state?.values?.[name];
  if (typed !== undefined) return typed;
  const saved = (initial as Record<string, unknown> | undefined)?.[name];
  return saved === null || saved === undefined ? "" : String(saved);
}
