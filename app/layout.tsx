import type { Metadata } from "next";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/sidebar";
import { SIDEBAR_COOKIE } from "@/components/sidebar-cookie";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROGRESS CRM",
  description: "CRM агентства PROGRESS Digital",
};

// cookies() делает шапку динамической: меню и счётчик лидов читаются на каждый запрос, а не при сборке
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const newLeads = await db.lead.count({ where: { status: "NEW" } });
  return (
    <html lang="ru">
      <body className="min-h-screen">
        <div className="flex min-h-screen gap-3 p-3">
          <Sidebar initialCollapsed={collapsed} newLeads={newLeads} />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <TopBar newLeads={newLeads} />
            <main className="flex flex-1 flex-col *:w-full">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
