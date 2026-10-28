import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFinModel, defaultFinModel, finModelFromTable, parseFinModel, parseNumberCell } from "../lib/finmodel";

// Таблица в том виде, в каком её копируют из Excel: столбцы через табуляцию, пустые ячейки, строки «Итого»
const table = [
  "Выручка\t1\t2\t3",
  "\tКол-во клиентов\t\t",
  "Сайты\t1\t2\t3",
  "SEO\t4\t5\t6",
  "\t\t\t",
  "Средний чек\t1\t2\t3",
  "Сайты\t100 000\t100000\t120000",
  "SEO\t20000\t20000\t20000",
  "Выручка\tМало\tНорма\tМного",
  "Сайты\t100000\t200000\t360000",
  "Итого:\t180000\t300000\t480000",
  "Затраты\t\t\t",
  "Зарплаты\t\t\t",
  "Дизайнер\t0\t50000\t",
  "Итого:\t0\t50000\t0",
  "Сервисы\t\t\t",
  "Хостинг\t1000\t1000\t2000",
  "\t1000\t1000\t2000",
  "Налоги и затраты\t\t\t",
  "Налог с прибыли\t10800\t18000\t28800",
  "Аренда\t5000\t5000\t5000",
  "Прибыль\t\t\t",
  "В месяц\t1\t2\t3",
].join("\n");

test("финмодель из таблицы Excel", () => {
  const m = finModelFromTable(table);
  assert.deepEqual(m.scenarios, ["Мало", "Норма", "Много"]);
  assert.deepEqual(
    m.services.map((s) => [s.name, s.clients, s.check]),
    [
      ["Сайты", [1, 2, 3], [100000, 100000, 120000]],
      ["SEO", [4, 5, 6], [20000, 20000, 20000]],
    ],
  );
  assert.deepEqual(
    m.costs.map((g) => [g.title, g.rows.map((r) => [r.name, r.values])]),
    [
      ["Зарплаты", [["Дизайнер", [0, 50000, 0]]]],
      ["Сервисы", [["Хостинг", [1000, 1000, 2000]]]],
      ["Налоги и затраты", [["Аренда", [5000, 5000, 5000]]]],
    ],
  );
  // Налог 10 800 при выручке 180 000 — 6 %
  assert.equal(m.taxPercent, 6);
});

test("расчёт прибыли", () => {
  const t = computeFinModel(finModelFromTable(table));
  assert.deepEqual(t.revenue, [180000, 300000, 480000]);
  assert.deepEqual(t.costs, [6000, 56000, 7000]);
  assert.deepEqual(t.tax, [10800, 18000, 28800]);
  assert.deepEqual(t.profit, [163200, 226000, 444200]);
  assert.deepEqual(t.margin, [91, 75, 93]);
});

test("числа из ячеек и сохранённая модель", () => {
  assert.equal(parseNumberCell("240 000 ₽"), 240000);
  assert.equal(parseNumberCell("1,5"), 1.5);
  assert.equal(parseNumberCell(""), null);
  assert.equal(parseFinModel("не json").scenarios.length, defaultFinModel().scenarios.length);
  // Значения подгоняются под число сценариев
  const saved = { scenarios: ["А", "Б"], services: [{ id: "s", name: "Сайт", clients: [1], check: [1, 2, 3] }], costs: [], taxPercent: 6 };
  assert.deepEqual(parseFinModel(JSON.stringify(saved)).services[0], { id: "s", name: "Сайт", clients: [1, 0], check: [1, 2] });
});

test("первый лист xlsx как таблица", async () => {
  const { default: JSZip } = await import("jszip");
  const { xlsxFirstSheetAsTable } = await import("../lib/xlsx-table");
  const zip = new JSZip();
  zip.file("xl/workbook.xml", '<workbook><sheets><sheet name="Модель" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file("xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file("xl/sharedStrings.xml", "<sst><si><t>Средний чек</t></si><si><r><t>Сай</t></r><r><t>ты &amp; лендинги</t></r></si></sst>");
  zip.file(
    "xl/worksheets/sheet1.xml",
    '<worksheet><sheetData><row r="2"><c r="B2" t="s"><v>0</v></c></row>' +
      '<row r="3"><c r="B3" t="s"><v>1</v></c><c r="C3"><v>100000</v></c><c r="E3"><f>C3*2</f><v>200000</v></c></row></sheetData></worksheet>',
  );
  const table = await xlsxFirstSheetAsTable(await zip.generateAsync({ type: "uint8array" }));
  assert.equal(table, "Средний чек\nСайты & лендинги\t100000\t\t200000");
});
