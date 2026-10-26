import { ChannelPage } from "@/components/channel-page";
import { TokenForm } from "@/components/token-form";
import { getSetting } from "@/lib/settings";
import { TELEGRAM_BOT_SETTING, TELEGRAM_PROXY_SETTING, TELEGRAM_TOKEN_SETTING } from "@/lib/chat/telegram";
import { Field, inputClass } from "@/components/field";
import { ActionButton } from "@/components/action-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { getRemindChat, getRemindCode } from "@/lib/reminders";
import { AutoRefresh } from "@/app/chats/auto-refresh";
import { deleteTelegramToken, saveTelegramToken, sendTestReminder, unlinkReminders } from "./actions";

export const dynamic = "force-dynamic";

export default async function TelegramPage() {
  const [token, bot, remindChat, proxy] = await Promise.all([
    getSetting(TELEGRAM_TOKEN_SETTING),
    getSetting(TELEGRAM_BOT_SETTING),
    getRemindChat(),
    getSetting(TELEGRAM_PROXY_SETTING),
  ]);
  const systemProxy = process.env.TELEGRAM_PROXY;
  const code = token && bot && !remindChat ? await getRemindCode() : null;
  return (
    <ChannelPage
      title="Telegram"
      intro="Клиенты пишут вашему боту, сообщения приходят в «Чаты», ответы из CRM уходят им в Telegram."
      connected={token ? `Подключён${bot ? ` · @${bot}` : ""}` : null}
      onDelete={deleteTelegramToken}
      link={bot ? { href: `https://t.me/${bot}`, label: `t.me/${bot}` } : null}
      form={
        <TokenForm
          action={saveTelegramToken}
          label={token ? "Новый токен бота (пусто — оставить прежний)" : "Токен бота"}
          placeholder="123456789:AAE… из @BotFather"
          submitLabel={token ? "Сохранить" : "Подключить бота"}
          after={
            <Field label="Прокси для Telegram, если без него не подключается">
              <input
                name="proxy"
                defaultValue={proxy ?? ""}
                autoComplete="off"
                placeholder={systemProxy ? `Сейчас системный: ${systemProxy}` : "http://127.0.0.1:1087"}
                className={inputClass}
              />
            </Field>
          }
        />
      }
      steps={[
        <>
          В Telegram откройте{" "}
          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            @BotFather
          </a>{" "}
          и отправьте команду /newbot.
        </>,
        "Придумайте название (например, «PROGRESS Digital») и имя бота, которое заканчивается на bot.",
        "BotFather пришлёт токен вида 123456789:AAE…: вставьте его выше и нажмите «Подключить бота».",
        "Напишите боту сами, и сообщение через несколько секунд появится в «Чатах».",
        "Если CRM пишет, что api.telegram.org не отвечает, значит провайдер блокирует Telegram. Включите VPN в режиме для всего Мака (TUN) или впишите HTTP-прокси вашего VPN-клиента, например http://127.0.0.1:1087, и сохраните.",
      ]}
      note="Сообщения принимаются, пока CRM запущена. Бот не пишет первым: клиент должен начать диалог."
      extra={
        token && bot ? (
          <section id="reminders" className="mb-6 scroll-mt-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Напоминания о встречах и задачах</h2>
              {remindChat ? (
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Приходят: {remindChat.name}</span>
                  <ConfirmDeleteButton action={unlinkReminders} message="Отключить напоминания в Telegram?" label="Отключить" />
                </div>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Не подключены</span>
              )}
            </div>
            {remindChat ? (
              <>
                <p className="mb-3 text-sm text-slate-600">
                  Бот @{bot} пишет вам перед встречами и задачами из календаря. Когда напомнить, выбирается в окне события.
                </p>
                <ActionButton action={sendTestReminder} label="Прислать проверочное" pendingLabel="Отправляю…" />
              </>
            ) : (
              <>
                <AutoRefresh ms={3000} />
                <p className="mb-3 text-sm text-slate-600">
                  Откройте ссылку в своём Telegram и нажмите «Запустить»: бот запомнит вас и будет присылать напоминания из календаря.
                </p>
                <a
                  href={`https://t.me/${bot}?start=crm-${code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700"
                >
                  Получать напоминания в Telegram
                </a>
              </>
            )}
          </section>
        ) : null
      }
    />
  );
}
