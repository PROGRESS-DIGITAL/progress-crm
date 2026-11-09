import { pdfResponse, renderProposal } from "@/lib/proposals/store";

export const dynamic = "force-dynamic";

// КП в PDF: собирается заново при каждом открытии, поэтому всегда с текущим шаблоном студии
export async function GET(req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const kp = await renderProposal(pid);
  if (!kp || kp.dealId !== id) return new Response("КП не найдено", { status: 404 });
  return pdfResponse(kp.bytes, kp.name, new URL(req.url).searchParams.has("download"));
}
