// Разделы CRM, которые можно открыть или закрыть роли. Ключ — первый сегмент адреса страницы
// и папка в app/, где лежат её серверные действия
export const SECTIONS = [
  { key: "deals", label: "Сделки" },
  { key: "dashboard", label: "Дашборд" },
  { key: "leads", label: "Лиды" },
  { key: "calendar", label: "Календарь" },
  { key: "tasks", label: "Задачи" },
  { key: "clients", label: "Клиенты" },
  { key: "chats", label: "Чаты" },
  { key: "mail", label: "Почта" },
  { key: "agents", label: "AI агенты" },
  { key: "sales-map", label: "Планограмма" },
  { key: "price", label: "Прайс" },
  { key: "finance", label: "Финансы" },
  { key: "documents", label: "Документы" },
  { key: "integrations", label: "Интеграции" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

const KEYS = new Set<string>(SECTIONS.map((s) => s.key));
// Только для директора, в роль не выдаются
const OWNER_ONLY = new Set(["employees"]);
// Открыты всем, кто вошёл: свой профиль, корень сайта, отчёт об ошибке в браузере
const ANY_USER = new Set(["", "profile", "logout", "api/client-error"]);

export const isSection = (key: string): key is SectionKey => KEYS.has(key);

// Адреса API и файлов относятся к разделу, данные которого отдают
const ALIASES: Record<string, string> = {
  "api/chats": "chats",
  "api/documents": "documents",
};

export type Access = { kind: "public" } | { kind: "any" } | { kind: "owner" } | { kind: "section"; keys: SectionKey[] };

// Что нужно, чтобы открыть адрес: вход не нужен, нужен любой вход, директор или конкретный раздел
export function accessForPath(pathname: string): Access {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] ?? "";
  if (first === "login" || (first === "api" && parts[1] === "webhooks")) return { kind: "public" };
  const two = parts.slice(0, 2).join("/");
  if (ANY_USER.has(two) || ANY_USER.has(first)) return { kind: "any" };
  if (OWNER_ONLY.has(first)) return { kind: "owner" };
  // Настройки AI агентов меняет только директор; сотрудникам с разделом агентов доступны чаты
  if (first === "agents" && (parts[1] === "new" || parts[2] === "edit")) return { kind: "owner" };
  const key = ALIASES[two] ?? first;
  if (isSection(key)) return { kind: "section", keys: [key] };
  // Неизвестный адрес: страница 404 от Next.js, но без входа и её не показываем
  return { kind: "any" };
}

// Действия, которыми пользуются страницы соседних разделов: задачи сохраняются через календарь,
// в сделке выставляют счета и договоры, реквизиты клиента правят из сделки и документов
const SHARED_ACTIONS: Partial<Record<SectionKey, SectionKey[]>> = {
  calendar: ["tasks"],
  finance: ["deals"],
  documents: ["deals"],
  clients: ["deals", "documents"],
};

// Серверное действие проверяется по файлу, где оно объявлено: app/finance/actions.ts — раздел finance
export function accessForActionFile(filename: string): Access {
  const m = filename.replace(/\\/g, "/").match(/(?:^|\/)app\/(.+)$/);
  if (!m) return { kind: "owner" };
  const access = accessForPath(`/${m[1]}`);
  if (access.kind !== "section") return access;
  return { kind: "section", keys: [...access.keys, ...(SHARED_ACTIONS[access.keys[0]] ?? [])] };
}

export function canAccess(access: Access, user: { isOwner: boolean; sections: readonly string[] } | null) {
  if (access.kind === "public") return true;
  if (!user) return false;
  if (user.isOwner || access.kind === "any") return true;
  if (access.kind === "owner") return false;
  return access.keys.some((k) => user.sections.includes(k));
}
