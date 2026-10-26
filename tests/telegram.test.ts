import { test } from "node:test";
import assert from "node:assert/strict";
import { incomingFromUpdate, isTelegramToken } from "../lib/chat/telegram";

test("разбирает личное сообщение боту", () => {
  const m = incomingFromUpdate({
    update_id: 10,
    message: {
      message_id: 5,
      date: 1_761_400_000,
      chat: { id: 42, type: "private", first_name: "Игорь", last_name: "Петров", username: "igor" },
      from: { id: 42, first_name: "Игорь", last_name: "Петров", username: "igor" },
      text: "Здравствуйте, сколько стоит сайт?",
    },
  });
  assert.deepEqual(m, {
    externalId: "42",
    name: "Игорь Петров",
    username: "igor",
    text: "Здравствуйте, сколько стоит сайт?",
    messageId: "5",
    date: new Date(1_761_400_000_000),
  });
});

test("фото с подписью и без текста не теряются", () => {
  const base = { update_id: 1, message: { message_id: 1, date: 0, chat: { id: 1, type: "private", username: "anna" } } };
  assert.equal(incomingFromUpdate({ ...base, message: { ...base.message, caption: "Вот логотип" } })?.text, "Вот логотип");
  const bare = incomingFromUpdate(base);
  assert.equal(bare?.text, "[вложение без текста]");
  assert.equal(bare?.name, "@anna");
});

test("сообщения из групп пропускаем", () => {
  assert.equal(
    incomingFromUpdate({ update_id: 1, message: { message_id: 1, date: 0, chat: { id: -5, type: "group" }, text: "привет" } }),
    null,
  );
});

test("проверяет формат токена", () => {
  assert.ok(isTelegramToken("123456789:AAEhBP0av28dRkyuX0Bvx7S-9oP6K9JV0nA"));
  assert.ok(!isTelegramToken("0337fef1234"));
});

test("понятная причина вместо fetch failed", async () => {
  const { networkError, isProxyUrl } = await import("../lib/chat/telegram");
  const failed = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } });
  assert.match(networkError(failed("UND_ERR_CONNECT_TIMEOUT")), /не отвечает.*VPN/);
  assert.match(networkError(failed("ECONNRESET")), /сброшено/);
  assert.match(networkError(failed("ENOTFOUND")), /интернет/);
  assert.match(networkError(new TypeError("fetch failed")), /нет связи с api\.telegram\.org: похоже, провайдер/);
  assert.ok(isProxyUrl("http://127.0.0.1:1087"));
  assert.ok(isProxyUrl("http://user:pass@proxy.example.com:3128"));
  assert.ok(!isProxyUrl("socks5://127.0.0.1:1080"));
  assert.ok(!isProxyUrl("127.0.0.1:1087"));
});
