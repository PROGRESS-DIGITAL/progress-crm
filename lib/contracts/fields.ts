import { fioGenitive, fioShort, genderOf, postGenitive } from "./names";
import { groupDigits, rublesText } from "./words";

// Сторона договора: клиент из карточки или исполнитель из «Моих реквизитов»
export type Party = {
  name: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  director: string | null;
  bankAccount: string | null;
  corrAccount: string | null;
  bankName: string | null;
  bik: string | null;
  phone: string | null;
  email: string | null;
  logo?: string | null;
};

export type ContractData = {
  number: string;
  date: Date;
  client: Party | null;
  executor: Party | null;
  deal: { title: string; amount: number; service: string | null } | null;
};

const PARTY_FIELDS = [
  ["название", "название"],
  ["инн", "ИНН"],
  ["кпп", "КПП"],
  ["огрн", "ОГРН"],
  ["адрес", "адрес"],
  ["р_с", "расчётный счёт"],
  ["к_с", "корр. счёт"],
  ["банк", "банк"],
  ["бик", "БИК"],
  ["телефон", "телефон"],
  ["email", "email"],
  ["руководитель", "руководитель (ФИО)"],
  ["именуемый", "«именуемое/именуемый»"],
  ["представитель", "«в лице директора … действующего на основании устава»"],
  ["подпись", "подпись (Фамилия И.О.)"],
  ["реквизиты", "все реквизиты списком"],
] as const;

// Поля для меню «Вставить поле» в редакторе шаблона
export const PLACEHOLDER_GROUPS: { title: string; fields: { key: string; label: string }[] }[] = [
  {
    title: "Договор",
    fields: [
      { key: "договор.номер", label: "номер" },
      { key: "договор.дата", label: "дата: 07 сентября 2026 г." },
      { key: "договор.дата_коротко", label: "дата: 07.09.2026" },
    ],
  },
  { title: "Клиент", fields: PARTY_FIELDS.map(([k, label]) => ({ key: `клиент.${k}`, label })) },
  {
    title: "Исполнитель",
    fields: [...PARTY_FIELDS.map(([k, label]) => ({ key: `исполнитель.${k}`, label })), { key: "исполнитель.логотип", label: "логотип" }],
  },
  {
    title: "Сделка",
    fields: [
      { key: "сделка.название", label: "название" },
      { key: "сделка.услуга", label: "услуга" },
      { key: "сделка.сумма", label: "сумма: 200 000 (двести тысяч) рублей" },
      { key: "сделка.сумма_числом", label: "сумма числом: 200 000" },
      { key: "сделка.предоплата", label: "предоплата 50% прописью" },
      { key: "сделка.остаток", label: "остаток 50% прописью" },
    ],
  },
];

const LABELS = new Map(PLACEHOLDER_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, `${g.title.toLowerCase()}: ${f.label}`])));

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function moscowParts(d: Date) {
  const [y, m, day] = new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10).split("-");
  return { y, m, day };
}

export function longDate(d: Date) {
  const { y, m, day } = moscowParts(d);
  return `${day} ${MONTHS[Number(m) - 1]} ${y} г.`;
}

export function shortDate(d: Date) {
  const { y, m, day } = moscowParts(d);
  return `${day}.${m}.${y}`;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ИП определяется по ИНН из 12 цифр или по названию
export function isIndividual(p: Pick<Party, "name" | "inn">) {
  return p.inn?.length === 12 || /^(ип\s|индивидуальный предприниматель)/i.test(p.name.trim());
}

// «Мулаков Никита Игоревич (директор)» → ФИО и должность; у ИП ФИО берётся из названия
export function personOf(p: Pick<Party, "name" | "inn" | "director">) {
  const m = p.director?.match(/^(.*?)\s*\((.+)\)\s*$/);
  let fio = (m ? m[1] : p.director)?.trim() || "";
  const post = m?.[2].trim() || "директор";
  if (isIndividual(p) && !fio) fio = p.name.replace(/^(ип|индивидуальный предприниматель)\s+/i, "").trim();
  return { fio, post };
}

function partyValues(p: Party | null): Record<string, string> {
  if (!p) return {};
  const individual = isIndividual(p);
  const { fio, post } = personOf(p);
  const female = fio ? genderOf(fio) === "f" : false;
  const blank = "____________";
  const representative = individual
    ? `${female ? "действующая" : "действующий"} на основании свидетельства о государственной регистрации физического лица в качестве индивидуального предпринимателя № ${p.ogrn ?? blank}`
    : `в лице ${postGenitive(post.toLowerCase())} ${fio ? fioGenitive(fio) : blank}, ${fio && female ? "действующей" : "действующего"} на основании устава`;
  const lines = [
    escapeHtml(p.name),
    p.inn && `ИНН ${p.inn}`,
    p.kpp && `КПП ${p.kpp}`,
    p.ogrn && `${individual ? "ОГРНИП" : "ОГРН"} ${p.ogrn}`,
    p.address && escapeHtml(p.address),
    p.bankAccount && `Р/с № ${p.bankAccount}`,
    p.bankName && escapeHtml(p.bankName),
    p.bik && `БИК ${p.bik}`,
    p.corrAccount && `К/с № ${p.corrAccount}`,
    p.phone && `Тел. ${escapeHtml(p.phone)}`,
    p.email && `E-mail: ${escapeHtml(p.email)}`,
  ].filter(Boolean);
  const text = (v: string | null | undefined) => (v ? escapeHtml(v) : "");
  return {
    название: text(p.name),
    инн: text(p.inn),
    кпп: text(p.kpp),
    огрн: text(p.ogrn),
    адрес: text(p.address),
    р_с: text(p.bankAccount),
    к_с: text(p.corrAccount),
    банк: text(p.bankName),
    бик: text(p.bik),
    телефон: text(p.phone),
    email: text(p.email),
    руководитель: text(fio),
    именуемый: individual ? (female ? "именуемая" : "именуемый") : "именуемое",
    представитель: escapeHtml(representative),
    подпись: text(fio ? fioShort(fio) : ""),
    реквизиты: lines.join("<br>"),
    логотип: p.logo?.startsWith("data:image/") ? `<img src="${p.logo}" alt="" style="max-height:60px">` : "",
  };
}

export function contractValues(data: ContractData) {
  const values: Record<string, string> = {
    "договор.номер": escapeHtml(data.number),
    "договор.дата": longDate(data.date),
    "договор.дата_коротко": shortDate(data.date),
  };
  for (const [prefix, party] of [["клиент", data.client], ["исполнитель", data.executor]] as const) {
    for (const [k, v] of Object.entries(partyValues(party))) values[`${prefix}.${k}`] = v;
  }
  if (data.deal) {
    const half = Math.round(data.deal.amount / 2);
    Object.assign(values, {
      "сделка.название": escapeHtml(data.deal.title),
      "сделка.услуга": escapeHtml(data.deal.service ?? ""),
      "сделка.сумма": data.deal.amount ? rublesText(data.deal.amount) : "",
      "сделка.сумма_числом": data.deal.amount ? groupDigits(data.deal.amount) : "",
      "сделка.предоплата": data.deal.amount ? rublesText(half) : "",
      "сделка.остаток": data.deal.amount ? rublesText(data.deal.amount - half) : "",
    });
  }
  return values;
}

const PLACEHOLDER = /\{\{\s*([^{}\s]+?)\s*\}\}/g;

// Подставляет значения в шаблон. Пустые поля остаются чертой для ручного заполнения
// и попадают в missing, чтобы показать, чего не хватает в карточке клиента или в реквизитах
export function fillTemplate(html: string, values: Record<string, string>) {
  const missing = new Set<string>();
  const filled = html.replace(PLACEHOLDER, (_, key: string) => {
    const v = values[key];
    // Номер и дату помечаем, чтобы при их смене в карточке договора текст обновился сам
    if (v && key.startsWith("договор.")) return `<span data-field="${key}">${v}</span>`;
    if (v) return v;
    // Логотипа может не быть: тогда просто пусто
    if (key === "исполнитель.логотип") return "";
    missing.add(LABELS.get(key) ?? key);
    return "____________";
  });
  return { html: filled, missing: [...missing] };
}

// Новые номер и дата в уже созданном договоре: меняются помеченные места текста
export function updateContractFields(html: string, number: string, date: Date) {
  const values: Record<string, string> = {
    "договор.номер": escapeHtml(number),
    "договор.дата": longDate(date),
    "договор.дата_коротко": shortDate(date),
  };
  return html.replace(/(<span data-field="(договор\.[^"]+)">)[^<]*(<\/span>)/g, (all, open: string, key: string, close: string) =>
    key in values ? `${open}${values[key]}${close}` : all,
  );
}
