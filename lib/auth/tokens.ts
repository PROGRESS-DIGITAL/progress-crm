import { createHash, randomBytes, randomInt } from "node:crypto";

// Токен для cookie: в браузере — сам токен, в базе — только его хэш
export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const sixDigits = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
