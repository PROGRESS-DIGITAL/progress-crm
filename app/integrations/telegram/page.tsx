import { ChannelPage } from "@/components/channel-page";
import { TokenForm } from "@/components/token-form";
import { getSetting } from "@/lib/chat/settings";
import { TELEGRAM_BOT_SETTING, TELEGRAM_TOKEN_SETTING } from "@/lib/chat/telegram";
import { deleteTelegramToken, saveTelegramToken } from "./actions";

export const dynamic = "force-dynamic";

export default async function TelegramPage() {
  const [token, bot] = await Promise.all([getSetting(TELEGRAM_TOKEN_SETTING), getSetting(TELEGRAM_BOT_SETTING)]);
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
          label={token ? "Новый токен бота" : "Токен бота"}
          placeholder="123456789:AAE… из @BotFather"
          submitLabel="Подключить бота"
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
      ]}
      note="Сообщения принимаются, пока CRM запущена. Бот не пишет первым: клиент должен начать диалог."
    />
  );
}
