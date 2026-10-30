import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/lib/auth/session";

// Главная ведёт в первый раздел, открытый сотруднику: директору — в сделки
export default async function Home() {
  const user = await currentUser();
  redirect(user ? homeFor(user) : "/login");
}
