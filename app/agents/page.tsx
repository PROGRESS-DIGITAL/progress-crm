import { redirect } from "next/navigation";
import { ensureDefaultAgent } from "@/lib/agents/agent";

export const dynamic = "force-dynamic";

// Раздел открывается с постоянного агента
export default async function AgentsPage() {
  const agent = await ensureDefaultAgent();
  redirect(`/agents/${agent.id}`);
}
