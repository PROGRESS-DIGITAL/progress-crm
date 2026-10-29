"use client";

import { useEffect } from "react";
import { LoadingBar } from "@/components/loading-bar";
import "./globals.css";

// Не загрузилась сама оболочка CRM (меню, шапка): например, база ещё запускается.
// Показываем полосу загрузки и перезагружаем страницу, пока сервер не ответит
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    const id = setTimeout(() => location.reload(), 3000);
    return () => clearTimeout(id);
  }, [error]);

  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col">
        <LoadingBar className="flex-1" />
        <p className="pb-6 text-center text-xs text-slate-400">{error.digest ? `Код ошибки: ${error.digest}` : error.message}</p>
      </body>
    </html>
  );
}
