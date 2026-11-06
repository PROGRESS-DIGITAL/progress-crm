import Link from "next/link";

// Задачи списком по срокам или доской команды
export function TaskViewTabs({ current }: { current: "list" | "board" }) {
  const tabs = [
    { key: "list", href: "/tasks", label: "Список" },
    { key: "board", href: "/tasks/board", label: "Доска" },
  ] as const;
  return (
    <nav className="flex rounded-xl bg-white p-1 text-sm shadow-card" aria-label="Вид задач">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={current === t.key ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 sm:px-4 ${current === t.key ? "bg-slate-900 font-medium text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
