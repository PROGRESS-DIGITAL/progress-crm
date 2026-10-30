import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Пароли хранятся только хэшем scrypt с солью: даже с копией базы их не узнать
const N = 16384;
const R = 8;
const P = 1;
const LEN = 32;

function derive(password: string, salt: Buffer, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, LEN, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  const parts = stored?.split("$");
  if (!parts || parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Требования к паролю: не короче 10 символов, буквы и цифры
export function passwordProblem(password: string) {
  if (password.length < 10) return "Пароль должен быть не короче 10 символов";
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return "В пароле должны быть буквы и цифры";
  return null;
}

// Временный пароль для нового сотрудника: без похожих символов, чтобы его легко было продиктовать
export function tempPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    const set = i % 4 === 3 ? digits : letters;
    out += set[bytes[i] % set.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}
