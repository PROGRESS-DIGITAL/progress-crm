import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { currentSession } from "@/lib/auth/session";
import { ensureTotpSecret } from "@/lib/auth/setup";
import { otpauthUrl } from "@/lib/auth/totp";
import { ownerTelegramReady } from "@/lib/auth/notify";
import { CodeForm, NewPasswordForm, TotpSetupForm } from "../forms";

export const metadata = { title: "Код входа — PROGRESS CRM" };

// Второй шаг входа. После пароля здесь по очереди: смена временного пароля, подключение приложения, код
export default async function CodePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "" } = await searchParams;
  const s = await currentSession();
  if (!s) redirect("/login");
  if (s.session.verified) redirect("/");
  const e = s.employee;

  if (e.mustChangePassword) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight">Новый пароль</h1>
        <p className="mt-1 mb-5 text-sm text-slate-600">
          {e.name}, вы вошли с временным паролем. Придумайте свой: его будете знать только вы.
        </p>
        <NewPasswordForm next={next} />
      </>
    );
  }

  if (!e.totpEnabled) {
    const secret = await ensureTotpSecret(e.id);
    const url = otpauthUrl(secret, e.login ?? e.name);
    const qr = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight">Код из приложения</h1>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          Чтобы никто не вошёл по одному паролю, при входе CRM будет спрашивать 6 цифр из приложения на телефоне.
        </p>
        <TotpSetupForm qrSvg={qr} secret={secret} url={url} next={next} />
      </>
    );
  }

  const telegram = e.isOwner && (await ownerTelegramReady());
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Код входа</h1>
      <p className="mt-1 mb-5 text-sm text-slate-600">Откройте приложение-аутентификатор и введите 6 цифр для PROGRESS CRM.</p>
      <CodeForm next={next} telegram={telegram} />
    </>
  );
}
