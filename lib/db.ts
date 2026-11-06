import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { createdActivity } from "@/lib/activity-text";

// Один клиент на процесс, чтобы hot reload в dev не плодил подключения
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const base = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

// Новые лиды, сделки, клиенты, контакты, встречи, задачи и договоры сами попадают в журнал событий:
// так в него пишут и формы, и импорт, и AI агенты, и Тильда, без отдельного вызова в каждом месте
const LOGGED = new Set(["Lead", "Deal", "Company", "Contact", "Event", "Contract", "BoardCard"]);
const silence = new AsyncLocalStorage<true>();

// Записи, созданные внутри fn, в журнал не попадают: так восстановление из корзины не выглядит как новая сделка
export const withoutActivity = <T>(fn: () => Promise<T>) => silence.run(true, fn);

export const db = base.$extends({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        if (!LOGGED.has(model) || silence.getStore()) return query(args);
        const a = args as { data: Record<string, unknown>; select?: Record<string, unknown> };
        if (a.select) a.select = { ...a.select, id: true };
        const result = await query(args);
        const entry = createdActivity(model, a.data, (result as { id?: string }).id);
        if (entry) {
          const { logActivity } = await import("@/lib/activity");
          await logActivity(entry);
        }
        return result;
      },
    },
  },
});
