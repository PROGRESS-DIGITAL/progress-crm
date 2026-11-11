import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/sidebar";
import { SIDEBAR_COOKIE } from "@/components/sidebar-cookie";
import { THEME_COOKIE } from "@/components/theme-cookie";
import { TopBar } from "@/components/top-bar";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { unreadChats } from "@/lib/chat/inbox";
import { dueWhere } from "@/lib/tasks";
import { teamBoards } from "@/lib/boards";
import { currentUser } from "@/lib/auth/session";
import { unseenActivity } from "@/lib/activity";
import { isDemo } from "@/lib/demo";
import { DemoBanner } from "@/components/demo-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROGRESS CRM",
  description: "CRM агентства PROGRESS Digital",
  // На iPhone «Поделиться» → «На экран Домой»: открывается на весь экран, без строки адреса Safari
  appleWebApp: { capable: true, title: "PROGRESS", statusBarStyle: "default" },
};

// Цвет строки состояния в приложении с экрана «Домой» совпадает с фоном выбранной темы
export async function generateViewport(): Promise<Viewport> {
  const dark = (await cookies()).get(THEME_COOKIE)?.value === "dark";
  return { themeColor: dark ? "#1c2637" : "#f1f3f8" };
}

// cookies() делает шапку динамической: меню и счётчик лидов читаются на каждый запрос, а не при сборке
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const collapsed = jar.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const theme = jar.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  const user = await currentUser();
  // Без входа proxy.ts пускает только на страницы /login: они без меню и шапки
  if (!user) {
    return (
      <html lang="ru" className={theme === "dark" ? "dark" : undefined}>
        <body className="min-h-screen">{children}</body>
      </html>
    );
  }
  const [newLeads, chats, dueTasks, unreadMail, unseen, boards] = await Promise.all([
    db.lead.count({ where: { status: "NEW" } }),
    unreadChats(),
    db.event.count({ where: dueWhere() }),
    db.mailMessage.count({ where: { folder: "INBOX", seen: false } }),
    unseenActivity(user),
    teamBoards(),
  ]);
  return (
    <html lang="ru" className={theme === "dark" ? "dark" : undefined}>
      <body className="min-h-screen">
        <ConfirmProvider>
          <PullToRefresh />
          <div className="flex min-h-screen gap-3 p-2 pb-24 sm:p-3 md:pb-3">
            <Sidebar
              initialCollapsed={collapsed}
              newLeads={newLeads}
              unreadChats={chats}
              dueTasks={dueTasks}
              unreadMail={unreadMail}
              boards={boards}
              sections={user.sections}
              isOwner={user.isOwner}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
              {isDemo() && <DemoBanner />}
              <TopBar unseenActivity={unseen} theme={theme} user={user} />
              <main className="flex flex-1 flex-col *:w-full">{children}</main>
            </div>
          </div>
        </ConfirmProvider>
      </body>
    </html>
  );
}
