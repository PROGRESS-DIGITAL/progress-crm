import { addDays, dayKey, fromKey } from "@/lib/calendar";

export type TaskBucket = "overdue" | "today" | "upcoming" | "done";

export const BUCKET_LABELS: Record<TaskBucket, string> = {
  overdue: "Просрочены",
  today: "На сегодня",
  upcoming: "Впереди",
  done: "Выполнены",
};

// Куда попадает задача в списке: просрочена, когда её срок (конец) прошёл; «на сегодня» — уже началась или начинается сегодня
export function taskBucket(t: { start: Date; end: Date; done: boolean }, now = new Date()): TaskBucket {
  if (t.done) return "done";
  if (t.end <= now) return "overdue";
  if (t.start < fromKey(addDays(dayKey(now), 1))) return "today";
  return "upcoming";
}

// Сколько задач требуют внимания сегодня: просроченные и текущие
export function dueWhere(now = new Date()) {
  return { kind: "TASK" as const, done: false, start: { lt: fromKey(addDays(dayKey(now), 1)) } };
}

export const MAX_FILE_SIZE = 15 * 1024 * 1024;

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}

// Имя файла без пути и управляющих символов, не длиннее 200 знаков с сохранением расширения
export function cleanFileName(name: string) {
  const base = name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]+/g, "").trim() || "файл";
  if (base.length <= 200) return base;
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 && base.length - dot <= 10 ? base.slice(dot) : "";
  return base.slice(0, 200 - ext.length) + ext;
}

// Что браузер может безопасно показать сам; остальное скачивается
const INLINE = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain)$/;
export function inlineType(mime: string) {
  return INLINE.test(mime);
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });

// Срок задачи для списка: «28 окт.» или «28 окт. – 2 нояб.»; у задач на весь день end — полночь после последнего дня
export function taskPeriod(t: { start: Date; end: Date; allDay: boolean }) {
  const first = dayKey(t.start);
  const last = t.allDay ? addDays(dayKey(t.end), -1) : dayKey(t.end);
  const a = dateFmt.format(t.start);
  return first >= last ? a : `${a} – ${dateFmt.format(fromKey(last))}`;
}
