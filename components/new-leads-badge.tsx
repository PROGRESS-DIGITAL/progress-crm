import { connection } from "next/server";
import { db } from "@/lib/db";

// Счётчик новых лидов в меню; connection() не даёт Next.js посчитать его один раз при сборке
export async function NewLeadsBadge() {
  await connection();
  const count = await db.lead.count({ where: { status: "NEW" } });
  if (count === 0) return null;
  return (
    <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{count}</span>
  );
}
