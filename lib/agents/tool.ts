import type { z } from "zod/v4";

// Инструмент агента: схема входа на zod и функция, которая выполняет запрос к CRM
export type Tool = {
  name: string;
  description: string;
  schema: z.ZodObject;
  run: (input: never) => Promise<unknown>;
};

export function tool<S extends z.ZodObject>(t: { name: string; description: string; schema: S; run: (input: z.output<S>) => Promise<unknown> }): Tool {
  return t as unknown as Tool;
}
