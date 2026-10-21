import { db } from "@/lib/db";

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
