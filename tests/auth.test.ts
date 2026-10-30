import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, base32Encode, totpCode, verifyTotp } from "../lib/auth/totp";
import { hashPassword, passwordProblem, tempPassword, verifyPassword } from "../lib/auth/password";
import { accessForActionFile, accessForPath, canAccess } from "../lib/auth/sections";
import { agentScopesFor } from "../lib/agents/tools";
import { ipBlocked, ipFailed } from "../lib/auth/limits";

// Тестовый вектор RFC 6238 (SHA1, ключ "12345678901234567890"), последние 6 цифр
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

test("TOTP совпадает с примерами RFC 6238", () => {
  assert.equal(totpCode(RFC_SECRET, 59_000), "287082");
  assert.equal(totpCode(RFC_SECRET, 1_111_111_109_000), "081804");
  assert.equal(totpCode(RFC_SECRET, 1_234_567_890_000), "005924");
  assert.equal(totpCode(RFC_SECRET, 2_000_000_000_000), "279037");
});

test("код принимается с запасом в один шаг, но не старше", () => {
  const t = 1_234_567_890_000;
  assert.ok(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, t - 30_000), t));
  assert.ok(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, t + 30_000), t));
  assert.ok(!verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, t - 90_000), t));
  assert.ok(verifyTotp(RFC_SECRET, "005 924", t));
  assert.ok(!verifyTotp(RFC_SECRET, "12345", t));
});

test("base32 туда и обратно", () => {
  const buf = Buffer.from([0, 1, 2, 250, 255, 7, 9]);
  assert.deepEqual(base32Decode(base32Encode(buf)), buf);
  assert.equal(base32Encode(Buffer.from("12345678901234567890")), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
});

test("пароль хранится хэшем и проверяется", async () => {
  const hash = await hashPassword("Секрет2026x");
  assert.ok(!hash.includes("Секрет"));
  assert.ok(await verifyPassword("Секрет2026x", hash));
  assert.ok(!(await verifyPassword("Секрет2026y", hash)));
  assert.ok(!(await verifyPassword("x", null)));
  assert.notEqual(await hashPassword("Секрет2026x"), hash);
});

test("требования к паролю и временный пароль", () => {
  assert.ok(passwordProblem("short1"));
  assert.ok(passwordProblem("onlyletterslong"));
  assert.equal(passwordProblem("longenough123"), null);
  const temp = tempPassword();
  assert.match(temp, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.equal(passwordProblem(temp), null);
});

const manager = { isOwner: false, sections: ["deals", "leads", "clients", "chats", "mail", "calendar", "tasks", "price", "documents"] };
const designer = { isOwner: false, sections: ["tasks", "calendar", "clients"] };
const owner = { isOwner: true, sections: [] };

test("разделы по адресу страницы", () => {
  assert.ok(canAccess(accessForPath("/login"), null));
  assert.ok(canAccess(accessForPath("/api/webhooks/tilda"), null));
  assert.ok(!canAccess(accessForPath("/deals"), null));
  assert.ok(canAccess(accessForPath("/deals/abc"), manager));
  assert.ok(!canAccess(accessForPath("/finance"), manager));
  assert.ok(!canAccess(accessForPath("/dashboard"), manager));
  assert.ok(!canAccess(accessForPath("/integrations/mail"), manager));
  assert.ok(!canAccess(accessForPath("/employees"), manager));
  assert.ok(canAccess(accessForPath("/employees"), owner));
  assert.ok(canAccess(accessForPath("/profile"), designer));
  assert.ok(canAccess(accessForPath("/"), designer));
  assert.ok(!canAccess(accessForPath("/api/chats/view"), designer));
  assert.ok(canAccess(accessForPath("/api/documents/1/pdf"), manager));
  assert.ok(canAccess(accessForPath("/tasks/files/1"), designer));
  assert.ok(!canAccess(accessForPath("/mail/files/1"), designer));
});

test("настройки AI агентов — только директору", () => {
  const withAgents = { isOwner: false, sections: ["agents"] };
  assert.ok(canAccess(accessForPath("/agents/abc"), withAgents));
  assert.ok(!canAccess(accessForPath("/agents/new"), withAgents));
  assert.ok(!canAccess(accessForPath("/agents/abc/edit"), withAgents));
});

test("серверные действия проверяются по файлу", () => {
  assert.ok(!canAccess(accessForActionFile("app/finance/actions.ts"), designer));
  // Задачи сохраняются через действия календаря, счета в сделке — через финансы
  assert.ok(canAccess(accessForActionFile("app/calendar/actions.ts"), { isOwner: false, sections: ["tasks"] }));
  assert.ok(canAccess(accessForActionFile("app/finance/actions.ts"), manager));
  assert.ok(!canAccess(accessForActionFile("app/integrations/telegram/actions.ts"), manager));
  assert.ok(canAccess(accessForActionFile("app/login/actions.ts"), null));
  assert.ok(canAccess(accessForActionFile("app/profile/actions.ts"), designer));
  assert.ok(!canAccess(accessForActionFile("app/employees/actions.ts"), manager));
  assert.ok(!canAccess(accessForActionFile("lib/whatever.ts"), manager));
});

test("агент отвечает сотруднику только по его разделам", () => {
  const all = ["money", "sales", "clients", "work", "comms", "plan", "edit"];
  assert.deepEqual(agentScopesFor(all, designer.sections), ["clients", "work"]);
  assert.deepEqual(agentScopesFor(all, manager.sections), ["sales", "clients", "work", "comms", "edit"]);
  assert.deepEqual(agentScopesFor(["money"], manager.sections), []);
});

test("перебор с одного адреса останавливается после 20 ошибок", () => {
  const ip = "203.0.113.7";
  const t = 1_000_000;
  for (let i = 0; i < 19; i++) ipFailed(ip, t);
  assert.ok(!ipBlocked(ip, t));
  ipFailed(ip, t);
  assert.ok(ipBlocked(ip, t));
  assert.ok(!ipBlocked(ip, t + 16 * 60_000));
});
