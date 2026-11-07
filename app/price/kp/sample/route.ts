import { pdfResponse, renderSample } from "@/lib/proposals/store";

export const dynamic = "force-dynamic";

// Пример КП по текущему шаблону: проверить, те ли слайды попали в начало и в конец
export async function GET() {
  return pdfResponse(await renderSample(), "Пример КП.pdf", false);
}
