// Календарь живёт по Москве: смещение UTC+3 без перехода на летнее время
const MSK = 3 * 3600_000;
const DAY = 86_400_000;

export type CalendarView = "day" | "week" | "month";
export const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
];

export function isView(v: unknown): v is CalendarView {
  return v === "day" || v === "week" || v === "month";
}

export function isDayKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

// Дата по Москве в виде «2026-10-26»
export function dayKey(d: Date) {
  return new Date(d.getTime() + MSK).toISOString().slice(0, 10);
}

// Момент времени для московской даты и минут от полуночи
export function fromKey(key: string, minutes = 0) {
  return new Date(Date.parse(`${key}T00:00:00Z`) - MSK + minutes * 60_000);
}

export function minutesOfDay(d: Date) {
  return Math.round(((d.getTime() + MSK) % DAY) / 60_000);
}

export function addDays(key: string, n: number) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

// Неделя начинается с понедельника
export function weekStart(key: string) {
  const weekday = (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(key, -weekday);
}

// Дни, которые показывает вид: месяц — целые недели, от понедельника до воскресенья
export function viewDays(view: CalendarView, key: string) {
  if (view === "day") return [key];
  if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(weekStart(key), i));
  const first = `${key.slice(0, 7)}-01`;
  const start = weekStart(first);
  const nextMonth = shift("month", first, 1);
  const days: string[] = [];
  for (let d = start; d < nextMonth || days.length % 7; d = addDays(d, 1)) days.push(d);
  return days;
}

export function shift(view: CalendarView, key: string, dir: number) {
  if (view === "day") return addDays(key, dir);
  if (view === "week") return addDays(key, 7 * dir);
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + dir, 1));
  return d.toISOString().slice(0, 10);
}

const monthYear = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const utc = (key: string) => new Date(`${key}T00:00:00Z`);
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

export function viewTitle(view: CalendarView, key: string) {
  if (view === "day") return capital(fullDay.format(utc(key)));
  if (view === "month") return capital(monthYear.format(utc(key)).replace(" г.", ""));
  const days = viewDays("week", key);
  const [a, b] = [days[0], days[6]];
  const year = b.slice(0, 4);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8))}–${dayMonth.format(utc(b))} ${year}`;
  return `${dayMonth.format(utc(a))} – ${dayMonth.format(utc(b))} ${year}`;
}

export type Timed = { id: string; start: Date; end: Date };
export type Placed = { id: string; top: number; height: number; col: number; cols: number };

// Раскладка событий одного дня по колонкам, как в Google Календаре: пересекающиеся встают рядом.
// top и height — минуты от полуночи; событие, начатое вчера или идущее до завтра, обрезается по дню
export function layoutDay(events: Timed[], key: string, minHeight = 20): Placed[] {
  const dayStart = fromKey(key).getTime();
  const items = events
    .map((e) => {
      const top = Math.max(0, (e.start.getTime() - dayStart) / 60_000);
      const bottom = Math.min(1440, (e.end.getTime() - dayStart) / 60_000);
      return { id: e.id, top, bottom: Math.max(bottom, top + minHeight) };
    })
    .filter((e) => e.top < 1440 && e.bottom > 0)
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const placed: Placed[] = [];
  let cluster: (Placed & { bottom: number })[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(0, ...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) placed.push({ id: c.id, top: c.top, height: c.bottom - c.top, col: c.col, cols });
    cluster = [];
  };
  for (const e of items) {
    if (e.top >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    // Первая колонка, где предыдущее событие уже закончилось
    let col = 0;
    while (cluster.some((c) => c.col === col && c.bottom > e.top)) col++;
    cluster.push({ id: e.id, top: e.top, bottom: e.bottom, height: 0, col, cols: 0 });
    clusterEnd = Math.max(clusterEnd, e.bottom);
  }
  flush();
  return placed;
}

// Попадает ли событие в день: для событий на весь день end — начало следующего за последним днём
export function coversDay(e: { start: Date; end: Date }, key: string) {
  const from = fromKey(key).getTime();
  return e.start.getTime() < from + DAY && e.end.getTime() > from;
}

export function timeLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
