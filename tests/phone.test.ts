import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPhone, normalizePhone } from "../lib/phone";

test("formatPhone: полный номер в любом виде", () => {
  assert.equal(formatPhone("89681111111"), "+7 (968) 111-11-11");
  assert.equal(formatPhone("+7 968 111 11 11"), "+7 (968) 111-11-11");
  assert.equal(formatPhone("7(968)111-11-11"), "+7 (968) 111-11-11");
  assert.equal(formatPhone("9681111111"), "+7 (968) 111-11-11");
  assert.equal(formatPhone("8 (968) 111-11-11 доб"), "+7 (968) 111-11-11");
});

test("formatPhone: маска по мере набора", () => {
  assert.equal(formatPhone("8"), "+7");
  assert.equal(formatPhone("89"), "+7 (9");
  assert.equal(formatPhone("8968"), "+7 (968");
  assert.equal(formatPhone("+7 (968) "), "+7 (968");
  assert.equal(formatPhone("89681"), "+7 (968) 1");
  assert.equal(formatPhone("8968111"), "+7 (968) 111");
  assert.equal(formatPhone("89681111"), "+7 (968) 111-1");
  assert.equal(formatPhone("8968111111"), "+7 (968) 111-11-1");
  assert.equal(formatPhone("896811111111"), "+7 (968) 111-11-11");
});

test("formatPhone: пустое и иностранное", () => {
  assert.equal(formatPhone(""), "");
  assert.equal(formatPhone("  "), "");
  assert.equal(formatPhone("+375 29 123-45-67"), "+375 29 123-45-67");
});

test("normalizePhone: полный номер в маску, остальное как есть", () => {
  assert.equal(normalizePhone("8 968 111 11 11"), "+7 (968) 111-11-11");
  assert.equal(normalizePhone(" 123 "), "123");
  assert.equal(normalizePhone("+7 968 111 11 11 доб. 12"), "+7 968 111 11 11 доб. 12");
  assert.equal(normalizePhone("+375 29 123-45-67"), "+375 29 123-45-67");
});
