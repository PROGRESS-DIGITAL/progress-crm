import { db } from "@/lib/db";
import { inlineType } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// Скачивание файла задачи; картинки и PDF открываются в браузере
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.eventFile.findUnique({ where: { id } });
  if (!file) return new Response("Файл не найден", { status: 404 });
  const inline = inlineType(file.mime);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": inline ? file.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="file"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
