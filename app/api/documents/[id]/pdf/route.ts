import { db } from "@/lib/db";
import { docTitle, getTochka } from "@/lib/finance/documents";
import { documentPdf } from "@/lib/finance/tochka";

// PDF счёта или акта берём из Точки при открытии: в CRM файлы не храним
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [doc, tochka] = await Promise.all([db.document.findUnique({ where: { id } }), getTochka()]);
  if (!doc?.tochkaId || !tochka) return new Response("Документ не найден", { status: 404 });
  try {
    const pdf = await documentPdf(
      tochka.token,
      doc.kind === "INVOICE" ? "bills" : "closing-documents",
      tochka.account.customerCode,
      doc.tochkaId,
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(`${docTitle(doc)}.pdf`)}`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Точка не отдала PDF", { status: 502 });
  }
}
