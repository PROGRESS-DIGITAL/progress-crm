import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, createdActivity, documentActivity, moveActivity, paymentActivity, taskMoveActivity } from "../lib/activity-text";

test("журнал: что пишется о новой записи и куда ведёт ссылка", () => {
  assert.deepEqual(createdActivity("Lead", { name: "Анна", source: "TILDA" }, "l1"), {
    section: "leads",
    kind: "create",
    text: "Новый лид с Тильды: Анна",
    href: "/leads/l1",
  });
  assert.equal(createdActivity("Lead", { phone: "+79000000000", source: "MANUAL" }, "l2")?.text, "Новый лид: +79000000000");
  assert.equal(createdActivity("Deal", { title: "Сайт" }, "d1")?.href, "/deals/d1");
  assert.equal(createdActivity("Company", { name: "ООО Ромашка" }, "c1")?.text, "Добавлен клиент «ООО Ромашка»");
  // Контакт ведёт в карточку клиента, даже если связь передана через connect
  assert.equal(createdActivity("Contact", { fullName: "Иван", company: { connect: { id: "c1" } } }, "p1")?.href, "/clients/c1");
  assert.deepEqual(createdActivity("Event", { kind: "TASK", title: "Позвонить" }, "e1"), {
    section: "tasks",
    kind: "create",
    text: "Создана задача «Позвонить»",
    href: "/tasks/e1",
  });
  const meeting = createdActivity("Event", { kind: "MEETING", title: "Бриф", start: new Date("2026-11-07T12:00:00Z") }, "e2");
  assert.equal(meeting?.section, "calendar");
  assert.match(meeting!.text, /^Назначена встреча «Бриф» на 7 нояб\.?, 15:00$/);
  assert.equal(meeting?.href, "/calendar?date=2026-11-07&open=e2");
  assert.equal(createdActivity("Product", { name: "x" }, "x1"), null);
  assert.equal(createdActivity("Deal", { title: "без id" }, undefined), null);
});

// В суммах неразрывные пробелы, сравниваем с обычными
const plain = (s: string) => s.replace(/\s/g, " ");

test("журнал: счета, оплаты и переносы сделок", () => {
  assert.equal(
    plain(documentActivity({ kind: "INVOICE", seq: 12, amount: 25000, dealId: "d1" }, "ООО Ромашка").text),
    "Выставлен счёт № 12 на 25 000 ₽ · ООО Ромашка",
  );
  const paid = paymentActivity({ amount: 25000, payerName: "ООО Ромашка" }, { seq: 12, dealId: "d1" });
  assert.equal(plain(paid.text), "Поступила оплата 25 000 ₽ от ООО Ромашка по счёту № 12");
  assert.equal(paid.href, "/deals/d1");
  assert.equal(paymentActivity({ amount: 900, payerName: null }, null).href, "/finance");
  assert.equal(moveActivity({ id: "d1", title: "Сайт" }, "Оплачен").text, "Сделка «Сайт» перешла на этап «Оплачен»");
});

test("журнал: время события словами", () => {
  const now = new Date("2026-11-06T09:00:00Z");
  assert.equal(ago(new Date("2026-11-06T08:59:40Z"), now), "только что");
  assert.equal(ago(new Date("2026-11-06T08:45:00Z"), now), "15 мин назад");
  assert.equal(ago(new Date("2026-11-06T06:05:00Z"), now), "сегодня, 09:05");
  assert.equal(ago(new Date("2026-11-05T11:00:00Z"), now), "вчера, 14:00");
  assert.match(ago(new Date("2026-11-03T11:00:00Z"), now), /^3 нояб\.?, 14:00$/);
});

test("перенос задачи на доске попадает в журнал со ссылкой на задачу", () => {
  assert.deepEqual(taskMoveActivity({ id: "t1", title: "Сверстать лендинг" }, "В работе", "Команда"), {
    section: "tasks",
    kind: "move",
    text: "Задача «Сверстать лендинг» перешла в «В работе» на доске «Команда»",
    href: "/tasks/t1",
  });
});
