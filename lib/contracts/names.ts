// Склонение ФИО и должностей в родительный падеж: «в лице директора Мулакова Никиты Игоревича»

export type Gender = "m" | "f";

const HUSHING = /[гкхжшчщ]$/i;
const VOWEL_END = /[оеиуюыэё]$/i;
const MALE_A_NAMES = new Set(["никита", "илья", "кузьма", "фома", "лука", "савва", "данила", "гаврила", "фока", "мина"]);

function keepCase(source: string, result: string) {
  return source[0] === source[0]?.toUpperCase() ? result[0].toUpperCase() + result.slice(1) : result;
}

// Окончание -а/-я → -ы/-и, с учётом «после г, к, х, ж, ш, ч, щ пишется и»
function aToGenitive(word: string) {
  const stem = word.slice(0, -1);
  if (/ия$/i.test(word)) return `${stem}и`;
  if (/я$/i.test(word)) return `${stem}и`;
  return HUSHING.test(stem) ? `${stem}и` : `${stem}ы`;
}

export function genderOf(fio: string): Gender {
  const [, first = "", patronymic = ""] = fio.trim().split(/\s+/);
  if (/(ич)$/i.test(patronymic)) return "m";
  if (/(на|кызы)$/i.test(patronymic)) return "f";
  if (/[ая]$/i.test(first) && !MALE_A_NAMES.has(first.toLowerCase())) return "f";
  return "m";
}

export function surnameGenitive(word: string, g: Gender) {
  const w = word.toLowerCase();
  if (g === "f") {
    if (/(ова|ева|ёва|ина|ына)$/.test(w)) return `${word.slice(0, -1)}ой`;
    if (/[жшчщ]ая$/.test(w)) return `${word.slice(0, -2)}ей`;
    if (/ая$/.test(w)) return `${word.slice(0, -2)}ой`;
    if (/[ая]$/.test(w)) return aToGenitive(word);
    return word;
  }
  if (/(ых|их)$/.test(w) || VOWEL_END.test(w)) return word;
  if (/[жшчщ]ий$/.test(w)) return `${word.slice(0, -2)}его`;
  if (/(ий|ый|ой)$/.test(w)) return `${word.slice(0, -2)}ого`;
  if (/[ьй]$/.test(w)) return `${word.slice(0, -1)}я`;
  if (/[ая]$/.test(w)) return aToGenitive(word);
  return `${word}а`;
}

const FIRST_NAME_EXCEPTIONS: Record<string, string> = { павел: "павла", лев: "льва", пётр: "петра", петр: "петра" };

export function firstNameGenitive(word: string, g: Gender) {
  const w = word.toLowerCase();
  if (FIRST_NAME_EXCEPTIONS[w]) return keepCase(word, FIRST_NAME_EXCEPTIONS[w]);
  if (/[ая]$/.test(w)) return aToGenitive(word);
  if (g === "f") return /ь$/.test(w) ? `${word.slice(0, -1)}и` : word;
  if (/[ьй]$/.test(w)) return `${word.slice(0, -1)}я`;
  if (VOWEL_END.test(w)) return word;
  return `${word}а`;
}

export function patronymicGenitive(word: string, g: Gender) {
  if (g === "f" && /на$/i.test(word)) return `${word.slice(0, -1)}ы`;
  if (g === "m" && /ич$/i.test(word)) return `${word}а`;
  return word;
}

// «Мулаков Никита Игоревич» → «Мулакова Никиты Игоревича»
export function fioGenitive(fio: string) {
  const g = genderOf(fio);
  const [surname, first, patronymic, ...rest] = fio.trim().split(/\s+/);
  return [
    surname && surnameGenitive(surname, g),
    first && firstNameGenitive(first, g),
    patronymic && patronymicGenitive(patronymic, g),
    ...rest,
  ]
    .filter(Boolean)
    .join(" ");
}

// «Мулаков Никита Игоревич» → «Мулаков Н.И.»
export function fioShort(fio: string) {
  const [surname, ...names] = fio.trim().split(/\s+/);
  if (!surname) return "";
  const initials = names.map((n) => `${n[0].toUpperCase()}.`).join("");
  return initials ? `${surname} ${initials}` : surname;
}

// «генеральный директор» → «генерального директора»: склоняются прилагательные и первое существительное
export function postGenitive(post: string) {
  const words = post.trim().split(/\s+/);
  const out: string[] = [];
  let declining = true;
  for (const word of words) {
    if (!declining) {
      out.push(word);
      continue;
    }
    const w = word.toLowerCase();
    if (/[жшчщ]ий$/.test(w)) out.push(`${word.slice(0, -2)}его`);
    else if (/(ый|ий|ой)$/.test(w)) out.push(`${word.slice(0, -2)}ого`);
    else {
      declining = false;
      if (/[ьй]$/.test(w)) out.push(`${word.slice(0, -1)}я`);
      else if (/[ая]$/.test(w)) out.push(aToGenitive(word));
      else if (VOWEL_END.test(w)) out.push(word);
      else out.push(`${word}а`);
    }
  }
  return out.join(" ");
}
