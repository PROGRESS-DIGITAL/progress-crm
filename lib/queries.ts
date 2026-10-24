import { db } from "@/lib/db";
import { sortByCategory } from "@/lib/format";

export function getStageOptions() {
  return db.stage.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });
}

export function getCompanyOptions() {
  return db.company.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      contacts: { orderBy: { fullName: "asc" }, select: { id: true, fullName: true } },
    },
  });
}

export async function getProductOptions() {
  const products = await db.product.findMany({
    select: { id: true, category: true, name: true, price: true, unit: true, service: true, salesStep: true, sortOrder: true },
  });
  return sortByCategory(products);
}

export type ProductOption = Awaited<ReturnType<typeof getProductOptions>>[number];
