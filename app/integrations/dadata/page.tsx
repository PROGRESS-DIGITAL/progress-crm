import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { getDadataKey } from "@/lib/dadata";
import { deleteDadataKey } from "./actions";
import { DadataKeyForm } from "./key-form";

export const dynamic = "force-dynamic";

export default async function DadataPage() {
  const key = await getDadataKey();

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href="/integrations" className="text-sm text-slate-500 hover:text-slate-800">
        ← Интеграции
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">DaData</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Заполнение карточки клиента по ИНН: название, КПП, ОГРН, адрес и руководитель из ЕГРЮЛ.
      </p>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white shadow-card p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-semibold">Ключ API</h2>
          {key ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                Подключено · ключ …{key.slice(-4)}
              </span>
              <ConfirmDeleteButton
                action={deleteDadataKey}
                message="Удалить ключ DaData? Заполнение по ИНН перестанет работать."
                label="Удалить ключ"
              />
            </div>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Не подключено</span>
          )}
        </div>
        <DadataKeyForm hasKey={!!key} />
      </section>

      <section className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-5 text-sm text-slate-700">
        <h2 className="mb-2 font-semibold text-slate-900">Как получить ключ</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Зарегистрируйтесь на{" "}
            <a href="https://dadata.ru" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              dadata.ru
            </a>
            . Бесплатного тарифа хватает: 10 000 запросов в день.
          </li>
          <li>В личном кабинете откройте «API-ключи» и скопируйте «API-ключ» (секретный ключ не нужен).</li>
          <li>Вставьте его выше и нажмите «Сохранить ключ»: CRM сразу проверит, что он работает.</li>
          <li>В карточке клиента введите ИНН и нажмите «Заполнить по ИНН».</li>
        </ol>
      </section>
    </div>
  );
}
