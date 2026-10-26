import { db } from "@/lib/db";
import { contractToDocx } from "@/lib/contracts/docx";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await db.contract.findUnique({ where: { id }, include: { company: { select: { name: true } } } });
  if (!contract) return new Response("Договор не найден", { status: 404 });
  const title = `Договор № ${contract.number}${contract.company ? ` ${contract.company.name}` : ""}`;
  const file = `${title.replace(/[\\/:*?"<>|«»]+/g, "").replace(/\s+/g, " ").trim()}.docx`;
  return new Response(new Uint8Array(await contractToDocx(title, contract.body)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="contract.docx"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "no-store",
    },
  });
}
