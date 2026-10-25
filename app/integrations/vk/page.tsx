import { ChannelPage } from "@/components/channel-page";
import { TokenForm } from "@/components/token-form";
import { getSetting } from "@/lib/chat/settings";
import { VK_GROUP_SETTING, VK_TOKEN_SETTING, type VkGroup } from "@/lib/chat/vk";
import { deleteVkToken, saveVkToken } from "./actions";

export const dynamic = "force-dynamic";

export default async function VkPage() {
  const [token, groupJson] = await Promise.all([getSetting(VK_TOKEN_SETTING), getSetting(VK_GROUP_SETTING)]);
  const group = groupJson ? (JSON.parse(groupJson) as VkGroup) : null;
  return (
    <ChannelPage
      title="VK"
      intro="Клиенты пишут в сообщения вашего сообщества ВКонтакте, переписка идёт через «Чаты»."
      connected={token ? `Подключено${group ? ` · ${group.name}` : ""}` : null}
      onDelete={deleteVkToken}
      link={group ? { href: `https://vk.me/${group.screenName}`, label: `vk.me/${group.screenName}` } : null}
      form={
        <TokenForm
          action={saveVkToken}
          label={token ? "Новый ключ сообщества" : "Ключ сообщества"}
          placeholder="vk1.a.… из «Работа с API»"
          submitLabel="Подключить сообщество"
        />
      }
      steps={[
        "В сообществе откройте «Управление → Сообщения» и включите сообщения сообщества.",
        "«Управление → Работа с API → Ключи доступа»: создайте ключ с правами «Сообщения сообщества» и «Управление сообществом».",
        "Там же на вкладке «Long Poll API» включите его и выберите версию 5.199, а в «Типах событий» отметьте «Входящее сообщение».",
        "Вставьте ключ выше и нажмите «Подключить сообщество»: CRM проверит ключ и Long Poll.",
      ]}
      note="Сообщения принимаются, пока CRM запущена. Сообщество может ответить только тому, кто написал ему сам."
    />
  );
}
