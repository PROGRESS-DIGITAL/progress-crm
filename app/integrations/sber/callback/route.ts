import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, SBER_STATE_SETTING, SberError } from "@/lib/finance/sber";
import { getSberClient, saveSberLogin } from "@/lib/finance/sber-service";
import { deleteSettings, getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Сюда СберБизнес возвращает пользователя после входа: меняем код на токены и находим счета
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const back = (q: Record<string, string>) => {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
    const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    return NextResponse.redirect(`${proto}://${host}/integrations/sber?${new URLSearchParams(q)}`, 303);
  };
  const saved = JSON.parse((await getSetting(SBER_STATE_SETTING)) ?? "null") as { state: string; at: number } | null;
  const error = url.searchParams.get("error");
  if (error) return back({ error: url.searchParams.get("error_description") || `СберБизнес отказал во входе: ${error}` });
  const code = url.searchParams.get("code");
  if (!code || !saved || saved.state !== url.searchParams.get("state") || Date.now() - saved.at > 30 * 60_000) {
    return back({ error: "Вход устарел или начат не из CRM, нажмите «Войти через СберБизнес» ещё раз" });
  }
  await deleteSettings(SBER_STATE_SETTING);
  const client = await getSberClient();
  if (!client) return back({ error: "Сначала сохраните ключи приложения" });
  try {
    const accounts = await saveSberLogin(client, await exchangeCode(client, code));
    return back({ ok: `Сбер подключён, счетов: ${accounts.length}` });
  } catch (e) {
    if (!(e instanceof SberError)) console.error(e);
    return back({ error: e instanceof Error ? e.message : "Не получилось подключить Сбер" });
  }
}
