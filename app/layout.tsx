import type { Metadata } from "next";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/sidebar";
import { SIDEBAR_COOKIE } from "@/components/sidebar-cookie";
import { THEME_COOKIE } from "@/components/theme-cookie";
import { TopBar } from "@/components/top-bar";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { unreadChats } from "@/lib/chat/inbox";
import { dueWhere } from "@/lib/tasks";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROGRESS CRM",
  description: "CRM агентства PROGRESS Digital",
};

// cookies() делает шапку динамической: меню и счётчик лидов читаются на каждый запрос, а не при сборке
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const collapsed = jar.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const theme = jar.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  const [newLeads, chats, dueTasks, unreadMail] = await Promise.all([
    db.lead.count({ where: { status: "NEW" } }),
    unreadChats(),
    db.event.count({ where: dueWhere() }),
    db.mailMessage.count({ where: { folder: "INBOX", seen: false } }),
  ]);
  return (
    <html lang="ru" className={theme === "dark" ? "dark" : undefined}>
      <body className="min-h-screen">
        <ConfirmProvider>
          <div className="flex min-h-screen gap-3 p-2 pb-24 sm:p-3 md:pb-3">
            <Sidebar initialCollapsed={collapsed} newLeads={newLeads} unreadChats={chats} dueTasks={dueTasks} unreadMail={unreadMail} />
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
              <TopBar newLeads={newLeads} theme={theme} />
              <main className="flex flex-1 flex-col *:w-full">{children}</main>
            </div>
          </div>
        </ConfirmProvider>
      </body>
    </html>
  );
}
