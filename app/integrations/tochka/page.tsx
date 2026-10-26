import { ChannelPage } from "@/components/channel-page";
import { TokenForm } from "@/components/token-form";
import { getTochka } from "@/lib/finance/documents";
import { NDS_KINDS, TOCHKA_ACCOUNTS_SETTING, type TochkaAccount } from "@/lib/finance/tochka";
import { getSetting } from "@/lib/settings";
import { chooseTochkaSettings, deleteTochkaToken, saveTochkaToken } from "./actions";

export const dynamic = "force-dynamic";

export default async function TochkaPage() {
  const [tochka, accountsJson] = await Promise.all([getTochka(), getSetting(TOCHKA_ACCOUNTS_SETTING)]);
  const accounts = JSON.parse(accountsJson ?? "[]") as TochkaAccount[];
  return (
    <ChannelPage
      title="Точка"
      intro="Счета и акты выставляются из сделки, оплаты подтягиваются из выписки: оплаченная сделка сама переходит в «Оплачен»."
      connected={tochka ? `Подключена · счёт ${tochka.account.name}` : null}
      onDelete={deleteTochkaToken}
      form={
        <div className="flex flex-col gap-5">
          {tochka && (
            <form action={chooseTochkaSettings} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">Расчётный счёт</span>
                <select name="accountId" defaultValue={tochka.account.accountId} className="h-10 rounded-xl border border-slate-200 bg-white pl-3 text-sm">
                  {accounts.map((a) => (
                    <option key={a.accountId} value={a.accountId}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">НДС в счетах и актах</span>
                <select name="nds" defaultValue={tochka.nds} className="h-10 rounded-xl border border-slate-200 bg-white pl-3 text-sm">
                  {Object.entries(NDS_KINDS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="h-10 rounded-xl border border-slate-200 px-4 text-sm hover:bg-slate-50">
                Сохранить
              </button>
            </form>
          )}
          <TokenForm
            action={saveTochkaToken}
            label={tochka ? "Новый JWT-токен" : "JWT-токен"}
            placeholder="eyJhbGciOi… из интернет-банка Точки"
            submitLabel="Подключить Точку"
          />
        </div>
      }
      steps={[
        "В интернет-банке Точки откройте «Интеграции и API» и выпустите JWT-ключ для своей интеграции.",
        "Отметьте права: «Счета и выставление документов», «Выписки и информация о счетах». Срок действия — максимальный.",
        "Скопируйте токен, вставьте выше и нажмите «Подключить Точку»: CRM проверит его и найдёт ваш расчётный счёт.",
        "Укажите, с НДС вы работаете или без. Номер счёта и акта CRM ставит сама, по порядку в году.",
      ]}
      note="Оплаты проверяются каждые 15 минут, пока CRM запущена, а в «Финансах» есть кнопка «Обновить сейчас»."
    />
  );
}
