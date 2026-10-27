// Российский телефон в виде +7 (968) 111-11-11. Работает и с недописанным номером, чтобы маска
// заполнялась по мере набора: «89681» → «+7 (968) 1». Ведущая 8 или 7 заменяется на +7, номер без кода
// страны (9681111111) тоже получает +7. Иностранный номер (+ и не 7) оставляем как есть
export function formatPhone(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("+") && !value.startsWith("+7")) return value;

  let digits = value.replace(/\D/g, "");
  if (!digits) return value.startsWith("+") ? "+" : "";
  if (digits[0] === "8" || digits[0] === "7") digits = digits.slice(1);
  digits = digits.slice(0, 10);

  let out = "+7";
  if (digits.length > 0) out += ` (${digits.slice(0, 3)}`;
  // Скобка закрывается только с четвёртой цифрой, иначе Backspace упирался бы в неё
  if (digits.length > 3) out += `) ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) out += `-${digits.slice(8, 10)}`;
  return out;
}

// Для сохранения и данных извне: полный российский номер приводим к маске, остальное (неполный,
// иностранный, «доб. 12») оставляем как ввели, чтобы не потерять цифры
export function normalizePhone(raw: string): string {
  const value = raw.trim();
  if (value.startsWith("+") && !value.startsWith("+7")) return value;
  const digits = value.replace(/\D/g, "");
  const full = digits.length === 10 || (digits.length === 11 && /^[78]/.test(digits));
  return full ? formatPhone(value) : value;
}
