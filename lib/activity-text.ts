import { formatRub } from "@/lib/format";

// Строка журнала событий: текст, ссылка и раздел, по которому решается, кому она видна
export type ActivityEntry = { section: string; kind: ActivityKind; text: string; href: string | null };
export type ActivityKind = "create" | "delete" | "restore" | "move" | "document" | "payment";

const MSK = "Europe/Moscow";
const when = (d: Date) =>
  d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: MSK }).replace(" в ", ", ");
const dayOf = (d: Date) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const date = (v: unknown) => {
  const d = v instanceof Date ? v : typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
// Связь в данных create бывает полем (companyId) или connect ({ company: { connect: { id } } })
function ref(data: Record<string, unknown>, field: string) {
  const direct = str(data[`${field}Id`]);
  if (direct) return direct;
  const rel = data[field] as { connect?: { id?: unknown } } | undefined;
  return str(rel?.connect?.id);
}

const LEAD_SOURCE: Record<string, string> = { TILDA: " с Тильды", CHAT: " из чата" };

// Что попадает в журнал, когда в базе создаётся запись. null — эту модель не записываем
export function createdActivity(model: string, data: Record<string, unknown>, id: string | undefined): ActivityEntry | null {
  if (!id) return null;
  switch (model) {
    case "Lead": {
      const who = str(data.name) ?? str(data.companyName) ?? str(data.phone) ?? str(data.email) ?? "без имени";
      return { section: "leads", kind: "create", text: `Новый лид${LEAD_SOURCE[String(data.source)] ?? ""}: ${who}`, href: `/leads/${id}` };
    }
    case "Deal":
      return { section: "deals", kind: "create", text: `Создана сделка «${str(data.title) ?? "без названия"}»`, href: `/deals/${id}` };
    case "Company":
      return { section: "clients", kind: "create", text: `Добавлен клиент «${str(data.name) ?? "без названия"}»`, href: `/clients/${id}` };
    case "Contact": {
      const company = ref(data, "company");
      return { section: "clients", kind: "create", text: `Добавлен контакт ${str(data.fullName) ?? "без имени"}`, href: company && `/clients/${company}` };
    }
    case "Event": {
      const title = str(data.title) ?? "без названия";
      if (data.kind === "TASK") return { section: "tasks", kind: "create", text: `Создана задача «${title}»`, href: `/tasks/${id}` };
      const start = date(data.start);
      const at = start && !data.allDay ? ` на ${when(start)}` : "";
      return {
        section: "calendar",
        kind: "create",
        text: `Назначена встреча «${title}»${at}`,
        href: `/calendar?${start ? `date=${dayOf(start)}&` : ""}open=${id}`,
      };
    }
    case "Contract":
      return { section: "documents", kind: "create", text: `Создан договор № ${str(data.number) ?? "—"}`, href: `/documents/contracts/${id}` };
    default:
      return null;
  }
}

const DOC_LABEL = { INVOICE: "счёт", ACT: "акт" } as const;

export function documentActivity(d: { kind: "INVOICE" | "ACT"; seq: number; amount: number; dealId: string }, company: string): ActivityEntry {
  const verb = d.kind === "INVOICE" ? "Выставлен" : "Создан";
  return {
    section: "finance",
    kind: "document",
    text: `${verb} ${DOC_LABEL[d.kind]} № ${d.seq} на ${formatRub(d.amount)} · ${company}`,
    href: `/deals/${d.dealId}`,
  };
}

export function paymentActivity(p: { amount: number; payerName: string | null }, invoice: { seq: number; dealId: string } | null): ActivityEntry {
  const from = p.payerName ? ` от ${p.payerName}` : "";
  return {
    section: "finance",
    kind: "payment",
    text: `Поступила оплата ${formatRub(p.amount)}${from}${invoice ? ` по счёту № ${invoice.seq}` : ""}`,
    href: invoice ? `/deals/${invoice.dealId}` : "/finance",
  };
}

// Задачу перетащили на доске в другой столбец
export function taskMoveActivity(task: { id: string; title: string }, column: string, board: string): ActivityEntry {
  return { section: "tasks", kind: "move", text: `Задача «${task.title}» перешла в «${column}» на доске «${board}»`, href: `/tasks/${task.id}` };
}

export function moveActivity(deal: { id: string; title: string }, stage: string): ActivityEntry {
  return { section: "deals", kind: "move", text: `Сделка «${deal.title}» перешла на этап «${stage}»`, href: `/deals/${deal.id}` };
}

// «только что», «5 мин назад», «сегодня, 14:05», «вчера, 14:05», «3 нояб., 14:05»
export function ago(d: Date, now = new Date()) {
  const min = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: MSK });
  const days = Math.round((Date.parse(dayOf(now)) - Date.parse(dayOf(d))) / 86_400_000);
  if (days === 0) return `сегодня, ${time}`;
  if (days === 1) return `вчера, ${time}`;
  return when(d);
}

export { dayOf as moscowDay };
