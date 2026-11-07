import { test } from "node:test";
import assert from "node:assert/strict";
import { newLeadText, requestOrigin } from "../lib/lead-notify";

test("текст уведомления о заявке", () => {
  const text = newLeadText(
    {
      id: "lead1",
      name: "Мария Тестова",
      phone: "+7 900 111-22-33",
      email: null,
      formName: "Форма на главной",
      utmSource: "yandex",
      utmCampaign: "brand",
      message: "Нужен сайт",
    },
    "https://crm.example.ru",
  );
  assert.equal(
    text,
    [
      "🔔 Новая заявка с сайта",
      "Имя: Мария Тестова",
      "Телефон: +7 900 111-22-33",
      "Форма: Форма на главной",
      "Реклама: yandex / brand",
      "",
      "Нужен сайт",
      "",
      "Открыть в CRM: https://crm.example.ru/leads/lead1",
    ].join("\n"),
  );
});

test("длинное сообщение обрезается", () => {
  const text = newLeadText({ id: "x", message: "а".repeat(2000) }, "https://crm.example.ru");
  assert.ok(text.length < 1000);
  assert.ok(text.includes("…"));
});

test("адрес CRM берётся из заголовков прокси", () => {
  const req = new Request("http://localhost:3000/api/webhooks/tilda", {
    headers: { "x-forwarded-host": "crm.example.ru", "x-forwarded-proto": "https" },
  });
  assert.equal(requestOrigin(req), "https://crm.example.ru");
  assert.equal(requestOrigin(new Request("http://localhost:3000/x")), "http://localhost:3000");
});
