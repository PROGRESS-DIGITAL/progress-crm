import { headers } from "next/headers";
import { ChannelPage } from "@/components/channel-page";
import { primaryButton } from "@/components/field";
import { getSber, getSberClient, sberAccounts } from "@/lib/finance/sber-service";
import { chooseSberAccount, deleteSber, saveSberClient, startSberLogin } from "./actions";
import { SberClientForm } from "./client-form";
import { StatementUpload } from "@/app/finance/statement-upload";

export const dynamic = "force-dynamic";

export default async function SberPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ ok, error }, client, sber, accounts, h] = await Promise.all([searchParams, getSberClient(), getSber(), sberAccounts(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = client?.redirectUri ?? `${proto}://${host}/integrations/sber/callback`;
  const current = accounts.find((a) => a.number === sber?.account);

  return (
    <ChannelPage
      title="Сбербанк"
      intro="Поступления на расчётный счёт в Сбере попадают в «Финансы» и закрывают счета из CRM, как с Точкой. Подключить можно по API СберБизнеса или загружать выписку файлом."
      connected={sber ? `Подключён · счёт ${current?.number ?? sber.account}` : null}
      onDelete={deleteSber}
      form={
        <div className="flex flex-col gap-5">
          {ok && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</p>}
          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {sber && accounts.length > 1 && (
            <form action={chooseSberAccount} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">Расчётный счёт</span>
                <select name="account" defaultValue={sber.account} className="h-10 rounded-xl border border-slate-200 bg-white pl-3 text-sm">
                  {accounts.map((a) => (
                    <option key={a.number} value={a.number}>
                      {a.number}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="h-10 rounded-xl border border-slate-200 px-4 text-sm hover:bg-slate-50">
                Сохранить
              </button>
            </form>
          )}
          <SberClientForm action={saveSberClient} clientId={client?.clientId ?? ""} redirectUri={redirectUri} hasCertificate={!!client?.pfx} />
          {client && (
            <form action={startSberLogin}>
              <button type="submit" className={primaryButton}>
                {sber ? "Войти через СберБизнес заново" : "Войти через СберБизнес"}
              </button>
            </form>
          )}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="mb-1 text-sm font-semibold">Без API: выписка файлом</h3>
            <p className="mb-3 text-sm text-slate-600">
              В СберБизнесе откройте «Выписки», выберите период и экспорт «1С» — получится файл kl_to_1c.txt. Загрузите его сюда: новые
              поступления добавятся, уже загруженные не задвоятся.
            </p>
            <StatementUpload />
          </div>
        </div>
      }
      steps={[
        "Подайте заявку на подключение к СберБизнес API для своей компании (developers.sber.ru → «СберБизнес API» → «Прямая интеграция»). Нужны права на выписку и список счетов.",
        "Получите от банка client_id и client_secret, сформируйте запрос на сертификат и скачайте выданный сертификат в формате .pfx (.p12).",
        "В настройках приложения у Сбера укажите Redirect URI из формы выше. CRM должна открываться по этому адресу из браузера.",
        "Сохраните ключи и сертификат, нажмите «Войти через СберБизнес» и подтвердите доступ. CRM найдёт рублёвые счета и начнёт забирать поступления.",
      ]}
      note="Поступления проверяются каждые 15 минут, пока CRM запущена; при первом подключении подтягивается история за год для дашборда. Client_secret у Сбера действует ограниченное время: если CRM напишет, что ключ не принят, обновите его в СберБизнесе и сохраните здесь."
    />
  );
}
