import { test } from "node:test";
import assert from "node:assert/strict";
import { numberToWords, rublesText } from "../lib/contracts/words";
import { fioGenitive, fioShort, genderOf, postGenitive } from "../lib/contracts/names";

test("суммы прописью", () => {
  assert.equal(numberToWords(200000), "двести тысяч");
  assert.equal(numberToWords(100000), "сто тысяч");
  assert.equal(numberToWords(1), "один");
  assert.equal(numberToWords(21001), "двадцать одна тысяча один");
  assert.equal(numberToWords(2512), "две тысячи пятьсот двенадцать");
  assert.equal(numberToWords(1_250_000), "один миллион двести пятьдесят тысяч");
  assert.equal(numberToWords(14_000), "четырнадцать тысяч");
  assert.equal(rublesText(200000), "200 000 (двести тысяч) рублей");
  assert.equal(rublesText(1001), "1 001 (одна тысяча один) рубль");
  assert.equal(rublesText(52), "52 (пятьдесят два) рубля");
});

test("ФИО в родительном падеже", () => {
  assert.equal(fioGenitive("Мулаков Никита Игоревич"), "Мулакова Никиты Игоревича");
  assert.equal(fioGenitive("Селин Илья Константинович"), "Селина Ильи Константиновича");
  assert.equal(fioGenitive("Иванова Мария Петровна"), "Ивановой Марии Петровны");
  assert.equal(fioGenitive("Достоевский Андрей Сергеевич"), "Достоевского Андрея Сергеевича");
  assert.equal(fioGenitive("Бондаренко Павел Игоревич"), "Бондаренко Павла Игоревича");
  assert.equal(fioGenitive("Гоголь Игорь Львович"), "Гоголя Игоря Львовича");
  assert.equal(fioGenitive("Ким Ольга Викторовна"), "Ким Ольги Викторовны");
  assert.equal(fioGenitive("Белая Анна Олеговна"), "Белой Анны Олеговны");
  assert.equal(genderOf("Мулаков Никита Игоревич"), "m");
  assert.equal(genderOf("Иванова Мария Петровна"), "f");
});

test("должности и подпись", () => {
  assert.equal(postGenitive("директор"), "директора");
  assert.equal(postGenitive("генеральный директор"), "генерального директора");
  assert.equal(postGenitive("управляющий"), "управляющего");
  assert.equal(postGenitive("председатель правления"), "председателя правления");
  assert.equal(fioShort("Мулаков Никита Игоревич"), "Мулаков Н.И.");
});

import { contractValues, fillTemplate, updateContractFields, type Party } from "../lib/contracts/fields";
import { sanitizeHtml } from "../lib/contracts/sanitize";
import { DEFAULT_TEMPLATE_BODY } from "../lib/contracts/default-template";

const party = (p: Partial<Party>): Party => ({
  name: "",
  inn: null,
  kpp: null,
  ogrn: null,
  address: null,
  director: null,
  bankAccount: null,
  corrAccount: null,
  bankName: null,
  bik: null,
  phone: null,
  email: null,
  ...p,
});

test("договор заполняется данными сторон и сделки", () => {
  const values = contractValues({
    number: "48",
    date: new Date("2026-09-07T09:00:00Z"),
    client: party({ name: "ООО «Ромашка»", inn: "7806583329", kpp: "780601001", director: "Иванова Мария Петровна (генеральный директор)", bik: "044525104" }),
    executor: party({ name: "ИП Петров Пётр Петрович", inn: "744800000000", ogrn: "311744800000000" }),
    deal: { title: "Сайт", amount: 200000, service: "Сайт" },
  });
  assert.equal(values["клиент.представитель"], "в лице генерального директора Ивановой Марии Петровны, действующей на основании устава");
  assert.equal(values["клиент.именуемый"], "именуемое");
  assert.equal(values["клиент.подпись"], "Иванова М.П.");
  assert.equal(values["исполнитель.именуемый"], "именуемый");
  assert.match(values["исполнитель.представитель"], /^действующий на основании свидетельства .* № 311744800000000$/);
  assert.equal(values["исполнитель.подпись"], "Петров П.П.");
  assert.equal(values["договор.дата"], "07 сентября 2026 г.");
  assert.equal(values["сделка.предоплата"], "100 000 (сто тысяч) рублей");
  assert.match(values["клиент.реквизиты"], /ООО «Ромашка»<br>ИНН 7806583329<br>КПП 780601001<br>БИК 044525104/);

  const { html, missing } = fillTemplate(DEFAULT_TEMPLATE_BODY, values);
  assert.doesNotMatch(html, /\{\{/);
  assert.ok(missing.includes("клиент: адрес") === false, "адрес в шаблоне только внутри реквизитов");
  assert.match(html, /<span data-field="договор.номер">48<\/span>/);
  const moved = updateContractFields(html, "49", new Date("2026-10-01T09:00:00Z"));
  assert.match(moved, /ДОГОВОР № <span data-field="договор.номер">49<\/span>/);
  assert.match(moved, /01 октября 2026 г\./);
});

test("пустые поля становятся чертой и попадают в список", () => {
  const { html, missing } = fillTemplate("<p>{{клиент.инн}} {{исполнитель.логотип}}</p>", {});
  assert.equal(html, "<p>____________ </p>");
  assert.deepEqual(missing, ["клиент: ИНН"]);
});

test("из HTML убирается исполняемое", () => {
  const dirty = `<p onclick="x()">a<script>alert(1)</script><a href="javascript:alert(1)">b</a><img src="data:image/png;base64,AAA" onerror="y"></p><iframe src="//e"></iframe>`;
  assert.equal(sanitizeHtml(dirty), `<p>a<a>b</a><img src="data:image/png;base64,AAA"></p>`);
});

import { contractToDocx } from "../lib/contracts/docx";

test("договор выгружается в .docx", async () => {
  const buf = await contractToDocx("Договор", `<p style="text-align:center"><strong>ДОГОВОР</strong> № 1</p><ul><li>раз</li></ul><table class="contract-plain"><tr><td style="text-align:right">дата</td></tr></table>`);
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  const JSZip = (await import("jszip")).default;
  const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
  assert.match(xml, /ДОГОВОР/);
  assert.match(xml, /<w:jc w:val="center"\/>/);
  assert.match(xml, /<w:jc w:val="right"\/>/);
  assert.match(xml, /<w:numPr>/);
});

test("преамбула в новой редакции: ОГРН в скобках, «в лице» только у организации", () => {
  const values = contractValues({
    number: "1",
    date: new Date("2026-10-26T09:00:00Z"),
    client: party({ name: "ООО «Ромашка»", ogrn: "1217800031855", director: "Мулаков Никита Игоревич (директор)" }),
    executor: party({ name: "ИП Петров Пётр Петрович", inn: "744800000000", ogrn: "311744800000000" }),
    deal: { title: "Сайт", amount: 200000, service: "Сайт" },
  });
  assert.equal(values["исполнитель.название_с_огрн"], "Индивидуальный предприниматель Петров Пётр Петрович (ОГРНИП 311744800000000)");
  assert.equal(values["клиент.название_с_огрн"], "ООО «Ромашка» (ОГРН 1217800031855)");
  assert.equal(values["клиент.в_лице"], ", в лице директора Мулакова Никиты Игоревича, действующего на основании устава");
  assert.equal(values["исполнитель.в_лице"], "");
  assert.equal(values["сделка.сумма_30"], "60 000 (шестьдесят тысяч) рублей");
  assert.equal(values["сделка.сумма_20"], "40 000 (сорок тысяч) рублей");

  const { html, missing } = fillTemplate(DEFAULT_TEMPLATE_BODY, values);
  assert.match(
    html,
    /Индивидуальный предприниматель Петров Пётр Петрович \(ОГРНИП 311744800000000\), именуемый в дальнейшем «Исполнитель», с одной стороны, и ООО «Ромашка» \(ОГРН 1217800031855\), именуемое в дальнейшем «Заказчик», в лице директора Мулакова Никиты Игоревича, действующего на основании устава, с другой стороны/,
  );
  assert.ok(!missing.some((m) => m.includes("в лице")));
});
