import { ChannelPage } from "@/components/channel-page";
import { TokenForm } from "@/components/token-form";
import { MAX_BOT_SETTING, MAX_TOKEN_SETTING } from "@/lib/chat/max";
import { getSetting } from "@/lib/chat/settings";
import { deleteMaxToken, saveMaxToken } from "./actions";

export const dynamic = "force-dynamic";

export default async function MaxPage() {
  const [token, bot] = await Promise.all([getSetting(MAX_TOKEN_SETTING), getSetting(MAX_BOT_SETTING)]);
  const username = bot?.startsWith("@") ? bot.slice(1) : null;
  return (
    <ChannelPage
      title="Max"
      intro="Клиенты пишут боту компании в Max, сообщения приходят в «Чаты», ответы из CRM уходят им в Max."
      connected={token ? `Подключён${bot ? ` · ${bot}` : ""}` : null}
      onDelete={deleteMaxToken}
      link={username ? { href: `https://max.ru/${username}`, label: `max.ru/${username}` } : null}
      form={
        <TokenForm
          action={saveMaxToken}
          label={token ? "Новый токен бота" : "Токен бота"}
          placeholder="Токен из раздела «Интеграция» вашего бота"
          submitLabel="Подключить бота"
        />
      }
      steps={[
        <>
          Войдите на{" "}
          <a href="https://business.max.ru" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            платформу Max для партнёров
          </a>{" "}
          и подтвердите организацию (ООО или ИП): без этого Max не даёт создать бота.
        </>,
        "В разделе «Чат-боты» создайте бота, затем откройте «Интеграция» и скопируйте токен.",
        "Вставьте токен выше и нажмите «Подключить бота»: CRM сразу проверит его.",
        "Напишите боту сами, и сообщение через несколько секунд появится в «Чатах».",
      ]}
      note="Сообщения принимаются, пока CRM запущена. Бот не пишет первым: клиент должен начать диалог."
    />
  );
}
