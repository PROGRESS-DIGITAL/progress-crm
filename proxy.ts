import { NextResponse, type NextRequest } from "next/server";

// Временная защита стенда общим логином и паролем, пока нет входа для сотрудников.
// Без BASIC_AUTH_USER и BASIC_AUTH_PASSWORD защита выключена (локальная разработка)
export function proxy(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !password) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const sep = decoded.indexOf(":");
    if (sep !== -1 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === password) {
      return NextResponse.next();
    }
  }
  return new NextResponse("Нужен логин и пароль", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="PROSTO CRM", charset="UTF-8"' },
  });
}

export const config = {
  // Webhook Тильды защищён своим ключом, статика не содержит данных
  matcher: ["/((?!api/webhooks|_next/static|_next/image|favicon.ico).*)"],
};
