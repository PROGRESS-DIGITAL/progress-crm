import { chatVersion } from "@/lib/chat/version";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ v: await chatVersion() }, { headers: { "cache-control": "no-store" } });
}
