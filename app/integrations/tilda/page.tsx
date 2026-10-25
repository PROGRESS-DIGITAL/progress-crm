import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { CopyField } from "@/components/copy-field";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { SERVICE_FIELDS, TILDA_FIELDS, type TildaField, type TildaFieldMap } from "@/lib/tilda";
import { getTildaSettings } from "@/lib/tilda-settings";
import { regenerateWebhookKey, resetFieldMap, setTildaEnabled } from "./actions";
import { FieldMapForm } from "./field-map-form";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; className: string }> = {
  ok: { label: "Лид создан", className: "bg-emerald-50 text-emerald-700" },
  duplicate: { label: "Повтор", className: "bg-slate-100 text-slate-600" },
  test: { label: "Проверка", className: "bg-blue-50 text-blue-700" },
  disabled: { label: "Выключено", className: "bg-amber-50 text-amber-800" },
  forbidden: { label: "Неверный ключ", className: "bg-rose-50 text-rose-700" },
};

// Куда попадёт поле формы: в поле лида, в UTM, в служебные или в текст сообщения
function destination(name: string, fieldMap: TildaFieldMap) {
  const key = name.toLowerCase();
  const field = (Object.keys(TILDA_FIELDS) as TildaField[]).find((f) => fieldMap[f].includes(key));
  if (field) return TILDA_FIELDS[field];
  if (key.startsWith("utm_")) return "UTM-метка";
  if (SERVICE_FIELDS.has(key)) return "служебное";
  return "в сообщение";
}

export default async function TildaPage() {
  const [settings, logs, h] = await Promise.all([
    getTildaSettings(),
    db.webhookLog.findMany({ where: { source: "tilda" }, orderBy: { createdAt: "desc" }, take: 30 }),
    headers(),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/webhooks/tilda?key=${settings.webhookKey}`;
  const isLocal = /^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/.test(host);

  // Названия полей из последних заявок: по ним удобно настраивать сопоставление
  const received = [
    ...new Set(
      logs
        .filter((l) => l.status !== "forbidden")
        .flatMap((l) => Object.keys((l.fields ?? {}) as Record<string, unknown>)),
    ),
  ].filter((k) => k.toLowerCase() !== "cookies");

  return (
    <div className="mx-auto max-w-5xl px-3 py-5">
      <Link href="/integrations" className="text-sm text-slate-500 hover:text-slate-800">
        ← Интеграции
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Тильда</h1>
          <p className="mt-1 text-sm text-slate-600">Заявки с форм сайта автоматически попадают в «Лиды»</p>
        </div>
        <form action={setTildaEnabled.bind(null, !settings.enabled)}>
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium ${settings.enabled ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}
          >
            {settings.enabled ? "Выключить приём заявок" : "Включить приём заявок"}
          </button>
        </form>
      </div>

      {!settings.enabled && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Приём выключен: Тильда получает ответ «ok», но лиды не создаются. Заявки видны в журнале ниже.
        </p>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white shadow-card p-5">
        <h2 className="font-semibold">1. Подключите webhook в Тильде</h2>
        <div className="mt-4">
          <CopyField label="Адрес webhook" value={webhookUrl} />
        </div>
        {isLocal && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Сейчас CRM открыта по адресу {host}, он есть только на этом компьютере. Тильда сможет отправлять
            заявки, когда CRM будет работать на сервере с адресом в интернете: тогда здесь появится нужная ссылка.
          </p>
        )}
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>
            В Тильде откройте «Настройки сайта» → «Формы» → <b>Webhook</b>.
          </li>
          <li>Вставьте адрес выше в поле «Адрес скрипта» и нажмите «Добавить». Тильда отправит проверочный запрос.</li>
          <li>
            В настройках каждого блока с формой (вкладка «Контент») отметьте этот Webhook среди подключённых сервисов
            и опубликуйте страницу.
          </li>
          <li>Отправьте заявку с сайта: она появится в журнале внизу и в «Лидах».</li>
        </ol>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <span>Если адрес попал к посторонним,</span>
          <ConfirmDeleteButton
            action={regenerateWebhookKey}
            message="Сменить ключ? Старый адрес перестанет работать, его нужно будет заменить в Тильде."
            label="смените ключ"
          />
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white shadow-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">2. Поля формы</h2>
            <p className="mt-1 text-sm text-slate-600">
              Для каждого поля лида перечислите через запятую названия полей формы в Тильде (как в редакторе: «Имя
              переменной»). Регистр не важен. Поля, которых здесь нет, попадут в текст сообщения лида.
            </p>
          </div>
          <ConfirmDeleteButton
            action={resetFieldMap}
            message="Вернуть названия полей по умолчанию?"
            label="Сбросить по умолчанию"
          />
        </div>
        {received.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Поля из последних заявок и куда они попадают:</p>
            <ul className="flex flex-wrap gap-2">
              {received.map((name) => (
                <li key={name} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  <span className="font-mono">{name}</span> → {destination(name, settings.fieldMap)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4">
          <FieldMapForm fieldMap={settings.fieldMap} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/60 bg-white shadow-card">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">3. Журнал запросов</h2>
        {logs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Запросов от Тильды ещё не было</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((l) => {
              const fields = (l.fields ?? {}) as Record<string, string>;
              const st = STATUS[l.status] ?? { label: l.status, className: "bg-slate-100 text-slate-600" };
              const summary = Object.entries(fields)
                .filter(([k]) => !SERVICE_FIELDS.has(k.toLowerCase()))
                .slice(0, 3)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ");
              return (
                <li key={l.id} className="px-5 py-3 text-sm">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                      <span className="w-36 shrink-0 text-slate-500 tabular-nums">{formatDateTime(l.createdAt)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${st.className}`}>{st.label}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-700">{summary || "—"}</span>
                      {l.leadId && (
                        <Link href={`/leads/${l.leadId}`} className="text-blue-600 hover:underline">
                          Открыть лид
                        </Link>
                      )}
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                      {JSON.stringify(fields, null, 2)}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
