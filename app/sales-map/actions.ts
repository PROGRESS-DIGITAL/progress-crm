"use server";

import { revalidatePath } from "next/cache";
import { FOLLOW_UP_OPTIONS, setFollowUpDays } from "@/lib/follow-ups";

export async function saveFollowUpDays(formData: FormData) {
  const days = Number(formData.get("days"));
  if (days !== 0 && !FOLLOW_UP_OPTIONS.includes(days)) return;
  await setFollowUpDays(days);
  revalidatePath("/sales-map");
}
