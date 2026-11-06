import { Icon, type IconName } from "@/components/icons";

// Значок строки журнала: что произошло — создание, удаление, перенос, документ или оплата
const KINDS: Record<string, { icon: IconName; className: string }> = {
  create: { icon: "plus", className: "bg-blue-50 text-blue-600" },
  delete: { icon: "trash", className: "bg-rose-50 text-rose-600" },
  restore: { icon: "refresh", className: "bg-emerald-50 text-emerald-600" },
  move: { icon: "deals", className: "bg-amber-50 text-amber-700" },
  document: { icon: "document", className: "bg-violet-50 text-violet-600" },
  payment: { icon: "wallet", className: "bg-emerald-50 text-emerald-600" },
};

export function ActivityIcon({ kind }: { kind: string }) {
  const k = KINDS[kind] ?? KINDS.create;
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${k.className}`}>
      <Icon name={k.icon} size={16} />
    </span>
  );
}
