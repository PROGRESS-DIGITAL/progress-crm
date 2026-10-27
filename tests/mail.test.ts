import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectProvider,
  emailsOf,
  formatAddresses,
  forwardSubject,
  htmlToText,
  makeSnippet,
  parseAddresses,
  quoteText,
  replySubject,
} from "../lib/mail/core";

test("detectProvider: Gmail и Яндекс по домену", () => {
  assert.equal(detectProvider("Studio@Gmail.com"), "GMAIL");
  assert.equal(detectProvider("a@ya.ru"), "YANDEX");
  assert.equal(detectProvider("a@yandex.ru"), "YANDEX");
  assert.equal(detectProvider("a@progrs.ru"), null);
});

test("адреса: строка заголовка и разбор поля «Кому»", () => {
  assert.equal(formatAddresses([{ name: "Иван", address: "ivan@a.ru" }, { address: "b@c.ru" }, { name: "Без адреса" }]), "Иван <ivan@a.ru>, b@c.ru");
  assert.deepEqual(parseAddresses("Иван <ivan@a.ru>; b@c.ru, плохой"), { valid: ["ivan@a.ru", "b@c.ru"], invalid: ["плохой"] });
  assert.deepEqual(parseAddresses("  "), { valid: [], invalid: [] });
  assert.deepEqual(emailsOf("Иван <Ivan@A.ru>, b@c.ru"), ["ivan@a.ru", "b@c.ru"]);
});

test("тема ответа и пересылки без повторов", () => {
  assert.equal(replySubject("Счёт"), "Re: Счёт");
  assert.equal(replySubject("RE: Счёт"), "RE: Счёт");
  assert.equal(forwardSubject("Счёт"), "Fwd: Счёт");
  assert.equal(forwardSubject("Fwd: Счёт"), "Fwd: Счёт");
});

test("текст письма: превью, HTML и цитата", () => {
  assert.equal(makeSnippet("Добрый\n\n  день"), "Добрый день");
  assert.equal(makeSnippet("а".repeat(200)).length, 158);
  assert.equal(htmlToText("<style>p{}</style><p>Привет&nbsp;&amp; пока</p><br>Ок"), "Привет & пока\n\nОк");
  assert.equal(quoteText("строка 1\nстрока 2", "Иван <ivan@a.ru>", new Date("2026-10-27T09:30:00Z")), "\n\n27 октября 2026 г. в 12:30, Иван <ivan@a.ru>:\n> строка 1\n> строка 2");
});
