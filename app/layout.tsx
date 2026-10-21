import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROGRESS CRM",
  description: "CRM агентства PROGRESS Digital",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex h-14 items-center gap-6 px-6">
            <Link href="/deals" className="font-semibold tracking-tight">
              PROGRESS <span className="text-blue-600">CRM</span>
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/deals" className="hover:text-slate-900">
                Сделки
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
