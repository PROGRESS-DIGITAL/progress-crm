// Демо-версия для клиентов (DEMO_MODE=1): отдельный экземпляр CRM со своей базой и вымышленными данными
// из prisma/demo-seed.ts. Вход без пароля одной кнопкой, настоящих данных агентства в этой базе нет.
export const isDemo = () => process.env.DEMO_MODE === "1";

// Разделы, где в демо-версии ничего не сохраняется: ключи сервисов, сотрудники и их пароли, профиль гостя.
// Иначе один гость мог бы подключить свой Telegram или сменить вход для всех остальных
const READ_ONLY = new Set(["integrations", "employees", "profile"]);

export const DEMO_READ_ONLY_MESSAGE = "В демо-версии эти настройки не сохраняются";

// Адрес страницы (/integrations/tilda) или файл серверного действия (app/employees/actions.ts)
export function demoReadOnly(pathOrFile: string) {
  const norm = pathOrFile.replace(/\\/g, "/");
  const m = norm.match(/(?:^|\/)app\/(.+)$/);
  const first = (m ? m[1] : norm).split("/").filter(Boolean)[0] ?? "";
  return READ_ONLY.has(first);
}
