import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Коды из приложения-аутентификатора (Google Authenticator, Яндекс Ключ и т. п.) по RFC 6238:
// 6 цифр, новый код каждые 30 секунд
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Неверный ключ");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, time = Date.now(), offset = 0) {
  const counter = Math.floor(time / 1000 / STEP) + offset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const num = (h.readUInt32BE(o) & 0x7fffffff) % 1_000_000;
  return String(num).padStart(6, "0");
}

// Принимаем код текущего, предыдущего и следующего шага: часы телефона могут немного спешить или отставать
export function verifyTotp(secret: string, code: string, time = Date.now()) {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return false;
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(totpCode(secret, time, d)), Buffer.from(clean)));
}

export function otpauthUrl(secret: string, account: string, issuer = "PROGRESS CRM") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
}
