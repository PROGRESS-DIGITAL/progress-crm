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
  withSignature,
  textToHtml,
  editorText,
  cleanEditorHtml,
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

test("подпись: в конце нового письма и над цитатой ответа", () => {
  assert.equal(withSignature("", "Иван\n+7 900"), "\n\n-- \nИван\n+7 900");
  assert.equal(withSignature("\n\n> старое", "Иван"), "\n\n-- \nИван\n\n> старое");
  assert.equal(withSignature("текст", "  "), "текст");
  assert.equal(withSignature("текст", null), "текст");
});

test("редактор письма: черновик в HTML и обратно в текст", () => {
  const html = textToHtml("Привет <друг>\n\n> цитата\n> вторая");
  assert.equal(html, '<div>Привет &lt;друг&gt;</div><div><br></div><blockquote style="margin:0 0 0 .8ex;border-left:2px solid #cbd5e1;padding-left:1ex;color:#475569">цитата<br>вторая</blockquote>');
  assert.equal(editorText(html), "Привет <друг>\n\n> цитата\n> вторая");
  assert.equal(editorText('<div><b>Сайт</b>: <a href="https://a.ru">тут</a>, <a href="mailto:b@c.ru">b@c.ru</a></div>'), "Сайт: тут (https://a.ru), b@c.ru");
});

test("редактор письма: опасное из HTML убирается", () => {
  assert.equal(cleanEditorHtml('<b onclick="x()">a</b><script>alert(1)</script><a href="javascript:alert(1)">l</a>'), '<b>a</b><a href="#">l</a>');
});
