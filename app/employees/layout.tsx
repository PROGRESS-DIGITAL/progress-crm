import { DemoReadOnlyNotice } from "@/components/demo-banner";
import { isDemo } from "@/lib/demo";

// В демо-версии раздел открывается только для просмотра: proxy.ts не пропускает его серверные действия
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {isDemo() && <DemoReadOnlyNotice />}
      {children}
    </>
  );
}
