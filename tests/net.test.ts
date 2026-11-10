import { test } from "node:test";
import assert from "node:assert/strict";
import { networkError } from "../lib/net";

const failed = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } });

test("сетевые ошибки российских сервисов советуют проверить VPN", () => {
  assert.match(networkError(failed("ECONNRESET"), "enter.tochka.com"), /соединение с enter\.tochka\.com сброшено, если включён VPN/);
  assert.match(networkError(failed("UND_ERR_CONNECT_TIMEOUT"), "enter.tochka.com"), /не отвечает/);
  assert.match(
    networkError(failed("SELF_SIGNED_CERT_IN_CHAIN"), "enter.tochka.com"),
    /^enter\.tochka\.com: система не доверяет сертификату сайта \(SELF_SIGNED_CERT_IN_CHAIN\)\. Скорее всего, это сертификат Минцифры/,
  );
  assert.equal(networkError(new Error("Точка ответила 401"), "enter.tochka.com"), "Точка ответила 401");
});

test("на сервере сетевые ошибки не советуют выключить VPN", () => {
  process.env.CRM_SERVER = "1";
  try {
    const msg = networkError(failed("UND_ERR_CONNECT_TIMEOUT"), "imap.yandex.ru");
    assert.match(msg, /с сервера CRM/);
    assert.doesNotMatch(msg, /выключите/);
  } finally {
    delete process.env.CRM_SERVER;
  }
});
