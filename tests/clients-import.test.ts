import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPerson, normalizeName, parseClientTable, planImport, siteHost, splitContacts, type ExistingCompany } from "../lib/clients-import";

const company = (c: Partial<ExistingCompany> & { id: string; name: string }): ExistingCompany => ({
  website: null,
  email: null,
  phone: null,
  notes: null,
  contacts: [],
  ...c,
});

test("контакты делятся по запятой, слэшу и по двум именам подряд", () => {
  assert.deepEqual(splitContacts("Пётр Ольга"), ["Пётр", "Ольга"]);
  assert.deepEqual(splitContacts("Пётр Иванов / Антон"), ["Пётр Иванов", "Антон"]);
  assert.deepEqual(splitContacts("Настя, Сидоров Ив"), ["Настя", "Сидоров Ив"]);
  assert.deepEqual(splitContacts("Олег "), ["Олег"]);
});

test("приписка с компанией убирается из имени контакта", () => {
  assert.equal(cleanPerson("Пётр Сидоров РМШ", ["Ромашка"]), "Пётр Сидоров");
  assert.equal(cleanPerson("Ольга Ромашка", ["Ромашка"]), "Ольга");
  assert.equal(cleanPerson("Олег Лютики", ["Суперлютик"]), "Олег");
  assert.equal(cleanPerson("Анна бот", ["Колокол"]), "Анна");
  assert.equal(cleanPerson("Елена", ["Елена-Сервис"]), "Елена");
});

test("сайт узнаётся без протокола и www, слово «сайт» сайтом не считается", () => {
  assert.equal(siteHost("https://www.Example.ru/about"), "example.ru");
  assert.equal(siteHost("example.ru"), "example.ru");
  assert.equal(siteHost("сайт"), null);
  assert.equal(siteHost("@someBot"), null);
});

test("название сравнивается без ООО, кавычек и регистра", () => {
  assert.equal(normalizeName("ООО «Ромашка»"), "ромашка");
  assert.equal(normalizeName("РОМАШКА"), "ромашка");
});

test("без шапки: компания, сайт, услуга, сумма, контакты, комментарий; сумма 1 — пометка", () => {
  const rows = parseClientTable(
    "Ромашка\thttps://romashka.test/\tSEO-продвижение\t25000\tПётр Ольга\tправки цен\n" + "\t\t\t\t\t\n" + "Лютик\tсайт\tЛоготип\t1\tАнна\tЛоготип\n",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].website, "https://romashka.test/");
  assert.equal(rows[0].note, "SEO-продвижение · 25 000 ₽ · правки цен");
  assert.deepEqual(rows[0].contacts, ["Пётр", "Ольга"]);
  assert.equal(rows[1].website, null);
  assert.equal(rows[1].note, "сайт · Логотип");
});

test("с шапкой колонки узнаются по названиям, строки без компании пропускаются", () => {
  const rows = parseClientTable(
    "Имя / Клиент\t\tПочта\tТелефон\tКомпания\tСайт\n" +
      "Пётр\t\tPetr@Romashka.test\t8 900 111-22-33\tРомашка\tromashka.test\n" +
      "Итого:\t\t\t\t\t\n",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Ромашка");
  assert.equal(rows[0].email, "petr@romashka.test");
  assert.equal(rows[0].phone, "+7 (900) 111-22-33");
  assert.deepEqual(rows[0].contacts, ["Пётр"]);
});

test("найденный клиент: заполненное остаётся, заметка дописывается, известные контакты не дублируются", () => {
  const rows = parseClientTable("ромашка\thttps://new.test/\tSEO\t\tОлег / Ольга\t\nКолокол\tlutik.test\t\t\t\t");
  const steps = planImport(rows, [
    company({ id: "1", name: "ООО «Ромашка»", website: "romashka.test", notes: "Старая заметка", contacts: [{ id: "c1", fullName: "Олег Смирнов", email: null, phone: null }] }),
    company({ id: "2", name: "Лютик", website: "https://lutik.test" }),
  ]);
  assert.equal(steps[0].match?.id, "1");
  assert.equal(steps[0].website, "romashka.test");
  assert.equal(steps[0].notes, "Старая заметка\n\nSEO");
  assert.deepEqual(steps[0].newContacts.map((c) => c.fullName), ["Ольга"]);
  // Узнан по сайту, хотя название другое
  assert.equal(steps[1].match?.id, "2");
});

test("почта одного человека идёт в его контакт, уже заполненная не меняется", () => {
  const rows = parseClientTable("Имя\tПочта\tКомпания\nОлег\toleg@r.test\tРомашка\nАнна\tanna@r.test\tРомашка");
  const steps = planImport(rows, [
    company({
      id: "1",
      name: "Ромашка",
      email: "office@r.test",
      contacts: [
        { id: "c1", fullName: "Олег", email: null, phone: null },
        { id: "c2", fullName: "Анна", email: "old@r.test", phone: null },
      ],
    }),
  ]);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].email, "office@r.test");
  assert.deepEqual(steps[0].contactUpdates, [{ id: "c1", fullName: "Олег", email: "oleg@r.test" }]);
});

test("повторная загрузка той же таблицы ничего не дублирует", () => {
  const rows = parseClientTable("Ромашка\t\tSEO\t\tОльга\t");
  const steps = planImport(rows, [company({ id: "1", name: "Ромашка", notes: "До\n\nSEO", contacts: [{ id: "c", fullName: "Ольга", email: null, phone: null }] })]);
  assert.equal(steps[0].notes, "До\n\nSEO");
  assert.deepEqual(steps[0].newContacts, []);
});

test("новая компания без совпадений создаётся с контактами", () => {
  const steps = planImport(parseClientTable("Новая\tnew.test\t\t\tИрина\t"), []);
  assert.equal(steps[0].match, null);
  assert.deepEqual(steps[0].newContacts, [{ fullName: "Ирина", email: null, phone: null }]);
});
