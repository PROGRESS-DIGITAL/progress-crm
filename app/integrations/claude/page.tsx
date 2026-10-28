import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { getSetting } from "@/lib/settings";
import { CLAUDE_KEY_SETTING, CLAUDE_URL_SETTING, DEFAULT_BASE_URL } from "@/lib/agents/agent";
import { deleteClaude } from "./actions";
import { ClaudeForm } from "./key-form";

export const dynamic = "force-dynamic";

export default async function ClaudePage() {
  const [key, url] = await Promise.all([getSetting(CLAUDE_KEY_SETTING), getSetting(CLAUDE_URL_SETTING)]);

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href="/integrations" className="text-sm text-slate-500 hover:text-slate-800">
        ← Интеграции
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Claude</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Модель, на которой работают{" "}
        <Link href="/agents" className="text-blue-600 hover:underline">
          AI агенты
        </Link>
        : понимает вопрос, сама смотрит нужные данные CRM и отвечает.
      </p>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Подключение</h2>
          {key ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Подключено · ключ …{key.slice(-4)}</span>
              <ConfirmDeleteButton action={deleteClaude} what="ключ Claude" message="AI агенты перестанут отвечать." label="Удалить ключ" />
            </div>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Не подключено</span>
          )}
        </div>
        <ClaudeForm hasKey={!!key} baseUrl={url ?? DEFAULT_BASE_URL} />
      </section>

      <section className="rounded-2xl border border-slate-200/60 bg-white p-5 text-sm text-slate-700 shadow-card">
        <h2 className="mb-2 font-semibold text-slate-900">Как получить ключ</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Зарегистрируйтесь в консоли Anthropic:{" "}
            <a href="https://platform.claude.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              platform.claude.com
            </a>
            , пополните баланс и создайте ключ в разделе «API keys».
          </li>
          <li>Вставьте ключ выше и нажмите «Сохранить»: CRM сразу проверит, что Claude отвечает.</li>
          <li>
            Из России API Anthropic напрямую не работает. Если проверка пишет об отказе в доступе, нужен посредник с API, совместимым с Anthropic:
            впишите его адрес в поле «Адрес API» и его ключ вместо ключа Anthropic.
          </li>
        </ol>
        <p className="mt-3 text-slate-500">
          Оплата идёт за объём текста: один вопрос агенту вместе с запросами к данным стоит примерно 5–20 ₽. Ключ хранится только в базе
          вашей CRM.
        </p>
      </section>
    </div>
  );
}
