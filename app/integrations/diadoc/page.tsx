import { ActionButton } from "@/components/action-button";
import { ChannelPage } from "@/components/channel-page";
import { Field, inputClass } from "@/components/field";
import { TokenForm } from "@/components/token-form";
import {
  DIADOC_CLIENT_SETTING,
  DIADOC_DEVICE_SETTING,
  DIADOC_IMPORT_SETTING,
  DIADOC_ORG_SETTING,
  DIADOC_REFRESH_SETTING,
  type DiadocClient,
  type DiadocOrg,
} from "@/lib/finance/diadoc";
import { formatDateTime } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { importClientsAction } from "../../finance/actions";
import { deleteDiadoc, restartDiadocLogin, saveDiadocClient } from "./actions";
import { LoginWaiter } from "./login-waiter";

export const dynamic = "force-dynamic";

export default async function DiadocPage() {
  const [clientJson, deviceJson, refresh, orgJson, importedAt] = await Promise.all([
    getSetting(DIADOC_CLIENT_SETTING),
    getSetting(DIADOC_DEVICE_SETTING),
    getSetting(DIADOC_REFRESH_SETTING),
    getSetting(DIADOC_ORG_SETTING),
    getSetting(DIADOC_IMPORT_SETTING),
  ]);
  const client = clientJson ? (JSON.parse(clientJson) as DiadocClient) : null;
  const device = deviceJson ? (JSON.parse(deviceJson) as { userCode: string; url: string; interval: number; expiresAt: number }) : null;
  const org = refresh && orgJson ? (JSON.parse(orgJson) as DiadocOrg) : null;

  return (
    <ChannelPage
      title="Диадок"
      intro="Акты из Точки загружаются в Диадок черновиком для отправки клиенту, а контрагенты из Диадока пополняют базу клиентов с реквизитами."
      connected={org ? `Подключён · ${org.name}` : null}
      onDelete={deleteDiadoc}
      form={
        <div className="flex flex-col gap-5">
          {org && (
            <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-4 text-sm">
              <p>
                Клиенты из Диадока загружаются раз в сутки.{" "}
                {importedAt ? `Последний раз: ${formatDateTime(new Date(importedAt))}.` : "Ещё не загружались."}
              </p>
              <ActionButton action={importClientsAction} label="Загрузить клиентов сейчас" pendingLabel="Загружаю…" />
            </div>
          )}
          {!org && device && (
            <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
              <p>
                Откройте{" "}
                <a href={device.url} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">
                  страницу входа Контура
                </a>
                , войдите под учётной записью Диадока и подтвердите код{" "}
                <span className="rounded bg-white px-2 py-0.5 font-mono font-semibold">{device.userCode}</span>.
              </p>
              {device.expiresAt > Date.now() ? (
                <LoginWaiter interval={Math.max(device.interval, 3)} />
              ) : (
                <form action={restartDiadocLogin}>
                  <button className="text-blue-700 underline">Код устарел, получить новый</button>
                </form>
              )}
            </div>
          )}
          <TokenForm
            action={saveDiadocClient}
            label="API-ключ приложения (client_secret)"
            placeholder="Из кабинета интегратора Контура, раздел «API-ключи»"
            submitLabel={org ? "Войти заново" : "Войти через Контур"}
            extra={
              <Field label="Идентификатор приложения (client_id)">
                <input name="clientId" defaultValue={client?.clientId ?? ""} autoComplete="off" className={inputClass} />
              </Field>
            }
          />
        </div>
      }
      steps={[
        <>
          Оставьте заявку на доступ к API на{" "}
          <a href="https://diadoc.com/integrations/api" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            странице интеграции Диадока
          </a>
          : менеджер Контура выдаст идентификатор приложения (client_id).
        </>,
        "В кабинете интегратора Контура в разделе «API-ключи» выпустите ключ (client_secret).",
        "Вставьте оба значения выше и нажмите «Войти через Контур», затем подтвердите вход кодом на странице Контура.",
        "Акт отправляется так: в сделке нажмите «В Диадок», затем в Диадоке откройте «Черновики», подпишите акт своей электронной подписью и отправьте.",
      ]}
      note="Подписать акт за вас CRM не может: для этого нужна ваша электронная подпись, поэтому акт ждёт в черновиках."
    />
  );
}
