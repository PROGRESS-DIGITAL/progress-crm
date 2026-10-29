// Ошибка, случившаяся в браузере, печатается в окне Терминала рядом с ошибками сервера
export async function POST(req: Request) {
  const e = (await req.json().catch(() => ({}))) as { message?: string; digest?: string; stack?: string; url?: string };
  console.error(`Ошибка в браузере на ${String(e.url ?? "").slice(0, 300)}: ${String(e.message ?? "").slice(0, 500)}`, e.digest ? `(код ${e.digest})` : "");
  if (e.stack) console.error(String(e.stack).slice(0, 2000));
  return new Response(null, { status: 204 });
}
