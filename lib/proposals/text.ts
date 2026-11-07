import { z } from "zod";
import { monthLabel, monthKey } from "@/lib/monthly";

// Содержимое КП без PDF: услуги, строки слайда «Стоимость и сроки», разбивка текста слайда на строки

export const MAX_ITEMS = 15;
export const MAX_TEXT = 6000;

export const itemSchema = z.object({
  productId: z.string().max(100).nullable().default(null),
  title: z.string().trim().min(1, "Укажите название услуги").max(200, "Слишком длинное название услуги"),
  text: z.string().max(MAX_TEXT, "Слишком длинный текст слайда").default(""),
  price: z.number().int("Цена в целых рублях").min(0, "Цена не может быть отрицательной").max(1_000_000_000, "Слишком большая цена"),
  // «от 60 000»: цена минимальная
  from: z.boolean().default(false),
  // «100 000 / месяц»: оплата каждый месяц, в итог разовых работ не входит
  monthly: z.boolean().default(false),
  // В скобках после цены: «сроки 2 мес», «настройка + подписка на год»
  note: z.string().trim().max(200, "Слишком длинное пояснение").default(""),
});
export type ProposalItem = z.infer<typeof itemSchema>;

export const itemsSchema = z.array(itemSchema).max(MAX_ITEMS, `Не больше ${MAX_ITEMS} услуг в одном КП`);

// Услуги из базы: что не читается, пропускаем, чтобы старое КП всё равно открылось
export function parseItems(value: unknown): ProposalItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const r = itemSchema.safeParse(v);
    return r.success ? [r.data] : [];
  });
}

// «Ноябрь, 2026» — как на обложке
export function periodLabel(date: Date) {
  const [month, year] = monthLabel(monthKey(date)).split(" ");
  return `${month}, ${year}`;
}

// Пробелы в числе неразрывные: сумма не разъедется по строкам
export const money = (n: number) => n.toLocaleString("ru-RU").replace(/\s/g, " ");

// Слово после числа: 1 слайд, 2 слайда, 5 слайдов
export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const rublesWord = (n: number) => plural(n, "рубль", "рубля", "рублей");
export const slidesLabel = (n: number) => `${n} ${plural(n, "слайд", "слайда", "слайдов")}`;

export function priceText(i: Pick<ProposalItem, "price" | "from" | "monthly">) {
  return `${i.from ? "от " : ""}${money(i.price)}${i.monthly ? " / месяц" : ""}`;
}

// «Создание сайта: 550 000 (сроки 2 мес)»
export function priceLine(i: ProposalItem) {
  return `${i.title}: ${priceText(i)}${i.note ? ` (${i.note})` : ""}`;
}

// Итог: разовые работы отдельно от ежемесячных
export function totalLines(items: ProposalItem[]) {
  const once = items.filter((i) => !i.monthly);
  const monthly = items.filter((i) => i.monthly);
  const sum = (list: ProposalItem[]) => list.reduce((a, i) => a + i.price, 0);
  const line = (list: ProposalItem[]) => {
    const total = sum(list);
    return `${list.some((i) => i.from) ? "от " : ""}${money(total)} ${rublesWord(total)}`;
  };
  const lines: string[] = [];
  if (once.length) lines.push(`Итого: ${line(once)}.`);
  if (monthly.length) lines.push(`${once.length ? "Плюс ежемесячно" : "Итого в месяц"}: ${line(monthly)}${once.length ? " в месяц" : ""}.`);
  return lines;
}

export type Style = "regular" | "bold" | "italic";
// Строка текста слайда; null — пустая строка между блоками
export type Block = { text: string; style: Style; marker?: string } | null;

// Текст слайда услуги: «1.» или «1)» — нумерованный пункт, «•», «-» — маркированный, строка с двоеточием в конце — подзаголовок
export function textBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const t = raw.trim();
    if (!t) {
      if (blocks.length && blocks.at(-1) !== null) blocks.push(null);
      continue;
    }
    const numbered = t.match(/^(\d{1,2}[.)])\s+(.+)$/);
    const bullet = t.match(/^[-–—•●▪*]\s+(.+)$/);
    if (numbered) blocks.push({ marker: numbered[1], text: numbered[2], style: "regular" });
    else if (bullet) blocks.push({ marker: "●", text: bullet[1], style: "regular" });
    else if (t.endsWith(":") && t.length <= 120) blocks.push({ text: t, style: "bold" });
    else blocks.push({ text: t, style: "regular" });
  }
  while (blocks.length && blocks.at(-1) === null) blocks.pop();
  return blocks;
}

// Слайд «Стоимость и сроки»: услуги по порядку, итог и примечание
export function priceBlocks(items: ProposalItem[], note: string | null): Block[] {
  const blocks: Block[] = items.map((i, n) => ({ marker: `${n + 1})`, text: priceLine(i), style: "regular" as const }));
  const totals = totalLines(items);
  if (totals.length) blocks.push(null, ...totals.map((text) => ({ text, style: "bold" as const })));
  const noteLines = (note ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (noteLines.length) blocks.push(null, ...noteLines.map((text) => ({ text, style: "italic" as const })));
  return blocks;
}

export type Measure = (text: string, style: Style, size: number) => number;
export type Placed = { text: string; style: Style; marker?: string; y: number };

// Перенос по словам; слово длиннее строки режется по буквам
export function wrap(text: string, width: number, fits: (s: string) => boolean) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/ +/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (fits(next)) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    let rest = word;
    while (!fits(rest) && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && !fits(rest.slice(0, cut))) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// Строки с координатой y от верха области текста. Пустая строка между блоками — одна строка высоты
export function layout(blocks: Block[], width: number, size: number, measure: Measure) {
  const step = size * 1.5;
  const lines: Placed[] = [];
  let y = 0;
  for (const b of blocks) {
    if (b === null) {
      y += step;
      continue;
    }
    wrap(b.text, width, (s) => measure(s, b.style, size) <= width).forEach((text, i) => {
      lines.push({ text, style: b.style, marker: i === 0 ? b.marker : undefined, y });
      y += step;
    });
  }
  return { lines, height: y };
}

export const MAX_SIZE = 10;
export const MIN_SIZE = 7;

// Крупнейший размер шрифта, при котором текст влезает в слайд; не влезает и при мелком — делится на несколько слайдов
export function fitText(blocks: Block[], width: number, height: number, measure: Measure) {
  for (let size = MAX_SIZE; size >= MIN_SIZE; size -= 0.5) {
    const l = layout(blocks, width, size, measure);
    if (l.height <= height) return { size, pages: [l.lines] };
  }
  const { lines } = layout(blocks, width, MIN_SIZE, measure);
  const step = MIN_SIZE * 1.5;
  const perPage = Math.max(1, Math.floor(height / step));
  const pages: Placed[][] = [];
  let page: Placed[] = [];
  let top = 0;
  for (const line of lines) {
    if (line.y - top >= perPage * step) {
      pages.push(page);
      page = [];
      top = line.y;
    }
    page.push({ ...line, y: line.y - top });
  }
  if (page.length) pages.push(page);
  return { size: MIN_SIZE, pages };
}

// Номера слайдов шаблона: «2-14, 16» → [2, 3, …, 14, 16]; null — записано с ошибкой или вне презентации
export function parsePages(spec: string, max: number): number[] | null {
  const pages: number[] = [];
  const s = spec.replace(/[–—]/g, "-").trim();
  if (!s) return pages;
  for (const part of s.split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a || b > max) return null;
    for (let p = a; p <= b; p++) pages.push(p);
  }
  return pages;
}

// Название файла: без символов, которые нельзя в именах файлов
export function proposalFileName(client: string, period: string) {
  return `КП ${client} ${period}`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() + ".pdf";
}
