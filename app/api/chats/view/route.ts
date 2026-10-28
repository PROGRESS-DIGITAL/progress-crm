import { chatVersion } from "@/lib/chat/version";
import { loadChatsView } from "@/lib/chat/view";

export const dynamic = "force-dynamic";

// Свежие данные «Чатов» для открытой страницы. Если ничего не поменялось, отвечает коротко
export async function GET(req: Request) {
  const url = new URL(req.url);
  const v = url.searchParams.get("v");
  const headers = { "cache-control": "no-store" };
  if (v && v === (await chatVersion())) return Response.json({ same: true }, { headers });
  return Response.json({ view: await loadChatsView(url.searchParams.get("c")) }, { headers });
}
