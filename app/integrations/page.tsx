import Link from "next/link";
import { db } from "@/lib/db";
import { getDadataKey } from "@/lib/dadata";
import { getTildaSettings } from "@/lib/tilda-settings";
import { getSetting } from "@/lib/chat/settings";
import { TELEGRAM_BOT_SETTING } from "@/lib/chat/telegram";
import { MAX_BOT_SETTING } from "@/lib/chat/max";
import { VK_GROUP_SETTING, type VkGroup } from "@/lib/chat/vk";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const [tilda, lastTilda, dadataKey, telegramBot, maxBot, vkGroup] = await Promise.all([
    getTildaSettings(),
    db.webhookLog.findFirst({ where: { source: "tilda", status: "ok" }, orderBy: { createdAt: "desc" } }),
    getDadataKey(),
    getSetting(TELEGRAM_BOT_SETTING),
    getSetting(MAX_BOT_SETTING),
    getSetting(VK_GROUP_SETTING),
  ]);
  const messengers = [
    { href: "/integrations/telegram", title: "Telegram", status: telegramBot && `@${telegramBot}`, text: "Переписка с клиентами через бота." },
    { href: "/integrations/max", title: "Max", status: maxBot, text: "Переписка с клиентами через бота компании в Max." },
    {
      href: "/integrations/vk",
      title: "VK",
      status: vkGroup && (JSON.parse(vkGroup) as VkGroup).name,
      text: "Сообщения сообщества ВКонтакте.",
    },
  ];
  const since = new Date(Date.now() - 30 * 86_400_000);
  const tildaLeads = await db.lead.count({ where: { source: "TILDA", createdAt: { gte: since } } });

  return (
    <div className="mx-auto w-full max-w-7xl px-1 py-4 sm:px-3 sm:py-5">
      <h1 className="text-2xl font-semibold tracking-tight">Интеграции</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">Откуда CRM получает данные автоматически</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/integrations/tilda"
          className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-5 hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Тильда</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${tilda.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
            >
              {tilda.enabled ? "Включена" : "Выключена"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">Заявки с форм сайта попадают в «Лиды».</p>
          <p className="mt-3 text-xs text-slate-500">
            {lastTilda ? `Заявок за 30 дней: ${tildaLeads}` : "Заявок ещё не было"}
          </p>
        </Link>
        <Link
          href="/integrations/dadata"
          className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-5 hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">DaData</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${dadataKey ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
            >
              {dadataKey ? "Подключено" : "Не подключено"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">Реквизиты клиента по ИНН: название, КПП, ОГРН, адрес, руководитель.</p>
        </Link>
        {messengers.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card hover:border-blue-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{m.title}</h2>
              <span
                className={`truncate rounded-full px-2 py-0.5 text-xs ${m.status ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
              >
                {m.status || "Не подключено"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{m.text} Сообщения приходят в «Чаты».</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
