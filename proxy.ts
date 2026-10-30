import { NextResponse, type NextRequest } from "next/server";
import { accessForActionFile, accessForPath, canAccess, type Access } from "@/lib/auth/sections";
import { SESSION_COOKIE, homeFor, sessionByToken } from "@/lib/auth/session-core";
import { actionFile } from "@/lib/auth/action-files";

// Вход в CRM проверяется здесь, до страниц и серверных действий: без входа открывается только /login,
// а закрытые роли разделы не отдаются даже по прямой ссылке или запросом в обход меню
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const actionId = req.headers.get("next-action");
  const isApi = pathname.startsWith("/api/");

  // Форма, отправленная до загрузки скриптов, приходит без заголовка Next-Action и с id действия в теле.
  // Проверить её здесь нельзя, поэтому просто открываем страницу заново
  if (!actionId && !isApi && req.method !== "GET" && req.method !== "HEAD") {
    return NextResponse.redirect(new URL(pathname + search, req.url), 303);
  }

  const auth = await sessionByToken(req.cookies.get(SESSION_COOKIE)?.value, true);
  const user = auth?.session.verified ? auth.user : null;
  const page = accessForPath(pathname);

  if (actionId) {
    const file = actionFile(actionId);
    let action: Access;
    if (file) action = accessForActionFile(file);
    else if (file === null) action = { kind: "owner" };
    // Манифеста нет только при разработке без сборки: проверяем по адресу страницы
    else action = page;
    if (canAccess(page, user) && canAccess(action, user)) return NextResponse.next();
    return new NextResponse(user ? "Нет доступа к этому разделу" : "Нужно войти в CRM", { status: user ? 403 : 401 });
  }

  if (page.kind === "public") {
    // Уже вошедшему форма входа не нужна
    if (user && pathname === "/login") return NextResponse.redirect(new URL(homeFor(user), req.url));
    return NextResponse.next();
  }
  if (!user) {
    if (isApi) return new NextResponse("Нужно войти в CRM", { status: 401 });
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  // Главная и закрытые разделы ведут в первый раздел, открытый сотруднику
  if (pathname === "/") return NextResponse.redirect(new URL(homeFor(user), req.url));
  if (!canAccess(page, user)) {
    if (isApi) return new NextResponse("Нет доступа к этому разделу", { status: 403 });
    return NextResponse.redirect(new URL(homeFor(user), req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Статика сборки не содержит данных; webhook Тильды защищён своим ключом и пропускается в accessForPath
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
