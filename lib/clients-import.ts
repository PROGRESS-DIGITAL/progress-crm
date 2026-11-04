import { normalizePhone } from "@/lib/phone";

// Загрузка клиентов таблицей, скопированной из Excel или Google Таблиц.
// Колонки узнаются по шапке («Компания», «Сайт», «Имя», «Почта», «Телефон», «Услуга», «Сумма», «Комментарий»).
// Без шапки порядок такой: компания, сайт, услуга, сумма, контакты, комментарий.

export type ImportRow = {
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  // Всё, что не ложится в поля клиента, уходит в заметки одной строкой
  note: string | null;
  contacts: string[];
};

// Частые имена: «Дмитрий Елена» — это два человека, а «Дмитрий Кузнецов» — один
const FIRST_NAMES = new Set(
  `александр александра алексей алена алёна алина алла анастасия анатолий андрей анна антон арина арсений артем артём
  артур богдан борис вадим валентин валентина валерий валерия василий вера вероника виктор виктория виталий владимир
  владислав всеволод вячеслав галина геннадий георгий глеб григорий дарья денис диана дмитрий евгений евгения егор
  екатерина елена елизавета жанна женя иван игорь илья инна ирина кайрат карина кирилл константин кристина ксения
  лариса леонид лидия любовь людмила максим маргарита марина мария марк матвей михаил надежда настя наталья наталия
  никита николай нина оксана олег олеся ольга павел петр пётр полина роман руслан руфат светлана святослав семен
  семён сергей софья станислав степан тамара татьяна тимофей тимур ульяна фанис федор фёдор филипп эдуард элина юлия
  юрий яна ярослав дима саша маша катя лена таня оля юля вика`.split(/\s+/),
);

const isFirstName = (w: string) => FIRST_NAMES.has(w.toLowerCase().replace(/[.,]/g, ""));

// «Илья / Максим», «Настя, Балбышев Дм», «Сергей Ирина» → отдельные люди
export function splitContacts(cell: string): string[] {
  const people: string[] = [];
  for (const chunk of cell.split(/[,/;]|\s+и\s+/)) {
    const words = chunk.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    if (words.length > 1 && words.every(isFirstName)) people.push(...words);
    else people.push(words.join(" "));
  }
  return [...new Set(people)];
}

// Сайт без протокола и www: по нему тоже узнаём уже заведённого клиента
export function siteHost(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  const host = v.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return /^[a-z0-9а-яё-]+(\.[a-z0-9а-яё-]+)+$/.test(host) ? host : null;
}

// Название для сравнения: без регистра, кавычек, ООО/ИП и лишних пробелов
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .replace(/(^| )(ооо|оао|зао|пао|ао|ип)(?= |$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// «25000» → «25 000 ₽»; «1» в колонке суммы — пометка, а не деньги; текст оставляем как есть
function amountText(cell: string): string | null {
  const v = cell.trim();
  if (!v) return null;
  const n = Number(v.replace(/[\s ₽]|руб\.?/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return v;
  return n >= 100 ? `${new Intl.NumberFormat("ru-RU").format(n).replace(/\s/g, " ")} ₽` : null;
}

type Column = "name" | "site" | "service" | "amount" | "contacts" | "comment" | "email" | "phone";
const DEFAULT_ORDER: Column[] = ["name", "site", "service", "amount", "contacts", "comment"];

// Порядок важен: «Имя / Клиент» — это люди, а компания — колонка «Компания»
const HEADER_RULES: [Column, RegExp][] = [
  ["contacts", /имя|контакт|фио|лпр/i],
  ["email", /почт|e-?mail/i],
  ["phone", /телефон|тел\.?$/i],
  ["site", /сайт|url|домен/i],
  ["service", /услуг|работ/i],
  ["amount", /сумм|чек|бюджет/i],
  ["comment", /коммент|заметк|примечан/i],
  ["name", /компан|организац/i],
  ["name", /клиент|название/i],
];

function headerColumns(cells: string[]): (Column | null)[] | null {
  const cols: (Column | null)[] = cells.map(() => null);
  for (const [col, re] of HEADER_RULES) {
    if (cols.includes(col)) continue;
    const i = cells.findIndex((c, idx) => cols[idx] === null && re.test(c));
    if (i >= 0) cols[i] = col;
  }
  // Шапка — это строка, где узналась компания и ещё хотя бы одна колонка
  return cols.includes("name") && cols.filter(Boolean).length >= 2 ? cols : null;
}

const splitLine = (line: string) => (line.includes("\t") ? line.split("\t") : line.split(";")).map((c) => c.trim());

export function parseClientTable(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.replace(/[\t;]/g, "").trim());
  if (!lines.length) return [];
  const header = headerColumns(splitLine(lines[0]));
  const columns = header ?? DEFAULT_ORDER;
  const rows: ImportRow[] = [];
  for (const line of header ? lines.slice(1) : lines) {
    const cells = splitLine(line);
    const get = (col: Column) => {
      const i = columns.indexOf(col);
      return i >= 0 ? (cells[i] ?? "") : "";
    };
    const name = get("name");
    if (!name) continue;
    const site = get("site");
    const website = siteHost(site) ? site : null;
    const note = [!website && site, get("service"), amountText(get("amount")), get("comment")]
      .filter((v): v is string => !!v)
      .filter((v, i, all) => all.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
      .join(" · ");
    const email = get("email").toLowerCase();
    const phone = get("phone");
    const people = get("contacts");
    rows.push({
      name,
      website,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      phone: phone.replace(/\D/g, "").length >= 10 ? normalizePhone(phone) : null,
      note: note || null,
      contacts: people ? splitContacts(people) : [],
    });
  }
  return rows;
}

type ExistingContact = { id: string; fullName: string; email: string | null; phone: string | null };
export type ExistingCompany = {
  id: string;
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  contacts: ExistingContact[];
};

export type NewContact = { fullName: string; email: string | null; phone: string | null };

export type ImportStep = {
  row: ImportRow;
  // null — новый клиент
  match: { id: string; name: string } | null;
  // Итоговые значения полей клиента: у найденного заполненное не меняется
  website: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  newContacts: NewContact[];
  // Уже заведённым контактам дописываются только пустые почта и телефон
  contactUpdates: { id: string; fullName: string; email?: string; phone?: string }[];
};

const STOP_WORDS = new Set(["бот", "сайт", "тг", "тест", "клиент"]);

// «Денис Борсук УТП», «Вероника Малиновка», «Дмитрий Сейфы»: приписку с названием компании убираем из имени
export function cleanPerson(person: string, companies: string[]): string {
  const brands = companies.map((c) => normalizeName(c).replace(/ /g, "")).filter(Boolean);
  const words = person.split(/\s+/).filter((w) => {
    if (isFirstName(w)) return true;
    const n = normalizeName(w).replace(/ /g, "");
    if (!n || STOP_WORDS.has(n)) return false;
    // Аббревиатура заглавными (УТП) — это компания, а не фамилия
    if (/^[A-ZА-ЯЁ]{2,5}$/.test(w)) return false;
    const stem = n.slice(0, Math.max(3, n.length - 2));
    return !brands.some((b) => b.includes(stem) || (n.length >= 4 && n.includes(b)));
  });
  return words.join(" ");
}

const firstWord = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

// Контакт уже есть, если совпадает имя целиком или «Олег» против «Олег Смирнов»
function findContact<T extends { fullName: string }>(list: T[], name: string): T | undefined {
  const n = name.trim().toLowerCase();
  return list.find((c) => {
    const e = c.fullName.trim().toLowerCase();
    if (e === n) return true;
    const short = !n.includes(" ") || !e.includes(" ");
    return short && firstWord(e) === firstWord(n);
  });
}

const addNote = (notes: string | null, note: string | null) =>
  !note || notes?.includes(note) ? notes : notes ? `${notes}\n\n${note}` : note;

// План загрузки: у найденного клиента заполненное остаётся как есть, пустое дополняется, заметка дописывается
export function planImport(rows: ImportRow[], existing: ExistingCompany[]): ImportStep[] {
  const byName = new Map(existing.map((c) => [normalizeName(c.name), c]));
  const bySite = new Map(existing.flatMap((c) => (siteHost(c.website) ? [[siteHost(c.website)!, c] as const] : [])));
  const steps: ImportStep[] = [];
  const planned = new Map<string, ImportStep>();

  for (const row of rows) {
    const host = siteHost(row.website);
    const key = normalizeName(row.name);
    let step = planned.get(key) ?? (host ? planned.get(`site:${host}`) : undefined);
    if (!step) {
      const found = byName.get(key) ?? (host ? bySite.get(host) : undefined);
      step = {
        row,
        match: found ? { id: found.id, name: found.name } : null,
        website: found?.website?.trim() || null,
        email: found?.email?.trim() || null,
        phone: found?.phone?.trim() || null,
        notes: found?.notes?.trim() || null,
        newContacts: [],
        contactUpdates: [],
      };
      steps.push(step);
      planned.set(key, step);
    }
    if (host) planned.set(`site:${host}`, step);
    // Одна компания дважды в таблице складывается в одну строку плана
    step.website ??= row.website;
    step.notes = addNote(step.notes, row.note);

    const known = existing.find((c) => c.id === step.match?.id)?.contacts ?? [];
    const people = row.contacts.map((p) => cleanPerson(p, [row.name, step.match?.name ?? ""])).filter(Boolean);
    // Почта и телефон из строки принадлежат человеку, если он в строке один; иначе — компании
    const personal = people.length === 1;
    if (!personal) {
      step.email ??= row.email;
      step.phone ??= row.phone;
    }
    for (const p of people) {
      const email = personal ? row.email : null;
      const phone = personal ? row.phone : null;
      const old = findContact(known, p);
      if (old) {
        const upd = { id: old.id, fullName: old.fullName, ...(!old.email && email && { email }), ...(!old.phone && phone && { phone }) };
        if ((upd.email || upd.phone) && !step.contactUpdates.some((u) => u.id === old.id)) step.contactUpdates.push(upd);
        continue;
      }
      const fresh = findContact(step.newContacts, p);
      if (fresh) {
        fresh.email ??= email;
        fresh.phone ??= phone;
      } else step.newContacts.push({ fullName: p, email, phone });
    }
  }
  return steps;
}
