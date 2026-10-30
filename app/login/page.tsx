import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { setupKey, setupNeeded } from "@/lib/auth/setup";
import { LoginForm, SetupForm } from "./forms";

export const metadata = { title: "Вход — PROGRESS CRM" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await setupNeeded()) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight">Вход директора</h1>
        <p className="mt-1 mb-5 text-sm text-slate-600">
          Придумайте логин и пароль. Следующим шагом подключите приложение для кодов входа на телефоне.
        </p>
        <SetupForm keyRequired={!!setupKey()} />
      </>
    );
  }
  const s = await currentSession();
  if (s && !s.session.verified) redirect(next ? `/login/code?next=${encodeURIComponent(next)}` : "/login/code");
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Вход в CRM</h1>
      <p className="mt-1 mb-5 text-sm text-slate-600">Логин и пароль выдаёт директор.</p>
      {error === "code" && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Слишком много неверных кодов. Войдите заново.</p>
      )}
      <LoginForm next={next ?? ""} />
    </>
  );
}
