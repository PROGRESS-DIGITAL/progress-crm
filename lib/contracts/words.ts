// Суммы прописью для договоров: «200 000 (двести тысяч) рублей»

const ONES_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять",
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

// Форма слова для числа: 1 рубль, 2 рубля, 5 рублей
export function plural(n: number, one: string, few: string, many: string) {
  const m100 = n % 100;
  const m10 = n % 10;
  if (m100 >= 11 && m100 <= 14) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

function triad(n: number, female: boolean) {
  const words = [HUNDREDS[Math.floor(n / 100)]];
  const rest = n % 100;
  if (rest >= 10 && rest < 20) words.push(TEENS[rest - 10]);
  else words.push(TENS[Math.floor(rest / 10)], (female ? ONES_F : ONES_M)[rest % 10]);
  return words.filter(Boolean).join(" ");
}

const SCALES: [number, boolean, string, string, string][] = [
  [1e9, false, "миллиард", "миллиарда", "миллиардов"],
  [1e6, false, "миллион", "миллиона", "миллионов"],
  [1e3, true, "тысяча", "тысячи", "тысяч"],
];

// Целое число прописью в мужском роде: 200000 → «двести тысяч»
export function numberToWords(value: number) {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "ноль";
  const words: string[] = [];
  for (const [size, female, one, few, many] of SCALES) {
    const part = Math.floor(n / size);
    if (part) words.push(triad(part, female), plural(part, one, few, many));
    n %= size;
  }
  if (n) words.push(triad(n, false));
  return words.join(" ");
}

// 200000 → «200 000»: неразрывные пробелы, чтобы сумма не разъезжалась по строкам
export function groupDigits(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function rublesText(n: number) {
  return `${groupDigits(n)} (${numberToWords(n)}) ${plural(Math.round(n), "рубль", "рубля", "рублей")}`;
}
