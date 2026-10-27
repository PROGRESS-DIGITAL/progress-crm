import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FIELD_MAP, isTildaTest, normalizeFieldMap, parseTildaLead } from "../lib/tilda";

test("распознаёт тестовый запрос Тильды", () => {
  assert.equal(isTildaTest({ test: "test" }), true);
  assert.equal(isTildaTest({ Name: "Иван" }), false);
});

test("разбирает стандартные поля формы", () => {
  const lead = parseTildaLead({
    Name: "Иван Петров",
    Phone: "+7 (900) 123-45-67",
    Email: "ivan@example.ru",
    Comments: "Нужен сайт",
    tranid: "1234567:890",
    formid: "form123",
    formname: "Заявка на сайт",
    utm_source: "yandex",
    utm_medium: "cpc",
  });
  assert.equal(lead.name, "Иван Петров");
  assert.equal(lead.phone, "+7 (900) 123-45-67");
  assert.equal(lead.email, "ivan@example.ru");
  assert.equal(lead.message, "Нужен сайт");
  assert.equal(lead.externalId, "1234567:890");
  assert.equal(lead.formName, "Заявка на сайт");
  assert.equal(lead.utmSource, "yandex");
  assert.equal(lead.utmMedium, "cpc");
});

test("понимает русские названия полей и форму без имени", () => {
  const lead = parseTildaLead({ "Имя": "Анна", "Телефон": "89001112233", formid: "form7" });
  assert.equal(lead.name, "Анна");
  assert.equal(lead.phone, "+7 (900) 111-22-33");
  assert.equal(lead.formName, "form7");
});

test("берёт UTM из cookie TILDAUTM", () => {
  const lead = parseTildaLead({
    Phone: "1",
    COOKIES: "_ym_uid=1; TILDAUTM=utm_source%3Dvk%7C%7C%7Cutm_campaign%3Dautumn; other=2",
  });
  assert.equal(lead.utmSource, "vk");
  assert.equal(lead.utmCampaign, "autumn");
});

test("незнакомые поля попадают в сообщение, ключ API — нет", () => {
  const lead = parseTildaLead({ Name: "Олег", Budget: "100 000", api_key: "secret" });
  assert.equal(lead.message, "Budget: 100 000");
  assert.equal("api_key" in lead.raw, false);
});

test("берёт поля по своим названиям из настроек", () => {
  const map = { ...DEFAULT_FIELD_MAP, phone: ["nomer"], name: ["client"] };
  const lead = parseTildaLead({ client: "Мария", nomer: "123", Phone: "999" }, map);
  assert.equal(lead.name, "Мария");
  assert.equal(lead.phone, "123");
  assert.equal(lead.message, "Phone: 999");
});

test("дополняет сохранённые настройки значениями по умолчанию", () => {
  const map = normalizeFieldMap({ phone: [" Nomer "], unknown: ["x"] });
  assert.deepEqual(map.phone, ["nomer"]);
  assert.deepEqual(map.name, DEFAULT_FIELD_MAP.name);
});
