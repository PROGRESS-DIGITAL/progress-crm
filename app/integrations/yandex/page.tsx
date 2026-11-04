import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { getSetting } from "@/lib/settings";
import { YANDEX_DEFAULT_MODEL, YANDEX_FOLDER_SETTING, YANDEX_KEY_SETTING, YANDEX_MODEL_SETTING } from "@/lib/agents/yandex";
import { deleteYandex } from "./actions";
import { YandexForm } from "./key-form";

export const dynamic = "force-dynamic";

export default async function YandexPage() {
  const [key, folderId, model] = await Promise.all([
    getSetting(YANDEX_KEY_SETTING),
    getSetting(YANDEX_FOLDER_SETTING),
    getSetting(YANDEX_MODEL_SETTING),
  ]);

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href="/integrations" className="text-sm text-slate-500 hover:text-slate-800">
        ← Интеграции
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">YandexGPT</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Модель Яндекса для{" "}
        <Link href="/agents" className="text-blue-600 hover:underline">
          AI агентов
        </Link>
        : работает из России напрямую. Какой агент на какой модели работает, выбирается в настройках агента.
      </p>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Подключение</h2>
          {key ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Подключено · ключ …{key.slice(-4)}</span>
              <ConfirmDeleteButton
                action={deleteYandex}
                what="ключ YandexGPT"
                message="Агенты на YandexGPT перестанут отвечать."
                label="Удалить ключ"
              />
            </div>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Не подключено</span>
          )}
        </div>
        <YandexForm hasKey={!!key} folderId={folderId ?? ""} model={model ?? YANDEX_DEFAULT_MODEL} />
      </section>

      <section className="rounded-2xl border border-slate-200/60 bg-white p-5 text-sm text-slate-700 shadow-card">
        <h2 className="mb-2 font-semibold text-slate-900">Как получить ключ</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Откройте{" "}
            <a href="https://aistudio.yandex.ru" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              AI Studio Яндекса
            </a>{" "}
            и выберите каталог, к которому привязан платёжный аккаунт.
          </li>
          <li>Нажмите «Создать API-ключ»: Яндекс сам создаст сервисный аккаунт с нужной ролью. Скопируйте ключ, он показывается один раз.</li>
          <li>Идентификатор каталога скопируйте, нажав на название каталога вверху экрана. Он начинается с b1g.</li>
          <li>Вставьте ключ и идентификатор выше и нажмите «Сохранить»: CRM сразу проверит, что модель отвечает.</li>
          <li>В настройках агента выберите модель «YandexGPT».</li>
        </ol>
        <p className="mt-3 text-slate-500">
          Модель по умолчанию — {YANDEX_DEFAULT_MODEL} (YandexGPT Lite). Если Яндекс переименует или заменит её, впишите новое название в поле
          «Модель», например yandexgpt для YandexGPT Pro. Ключ хранится только в базе вашей CRM.
        </p>
      </section>
    </div>
  );
}
