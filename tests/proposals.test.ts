import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  fitText,
  itemsSchema,
  parseItems,
  parsePages,
  periodLabel,
  priceBlocks,
  priceLine,
  proposalFileName,
  slidesLabel,
  textBlocks,
  totalLines,
  wrap,
  type ProposalItem,
} from "../lib/proposals/text";
import { buildProposalPdf } from "../lib/proposals/pdf";

const item = (patch: Partial<ProposalItem>): ProposalItem => ({
  productId: null,
  title: "Сайт",
  text: "",
  price: 100_000,
  from: false,
  monthly: false,
  note: "",
  ...patch,
});

test("текст слайда: подзаголовки, нумерованные и маркированные пункты", () => {
  const blocks = textBlocks("Этапы работы:\n1. Прототип\n2) Дизайн\n\n\n• Вёрстка\n- Запуск\nПросто абзац\n\n");
  assert.deepEqual(blocks, [
    { text: "Этапы работы:", style: "bold" },
    { marker: "1.", text: "Прототип", style: "regular" },
    { marker: "2)", text: "Дизайн", style: "regular" },
    null,
    { marker: "●", text: "Вёрстка", style: "regular" },
    { marker: "●", text: "Запуск", style: "regular" },
    { text: "Просто абзац", style: "regular" },
  ]);
});

test("строки стоимости и итог: разовые отдельно от ежемесячных", () => {
  const items = [
    item({ title: "Сайт", price: 550_000, note: "сроки 2 мес" }),
    item({ title: "Чат-виджет", price: 60_000, from: true }),
    item({ title: "SEO", price: 100_000, monthly: true }),
  ];
  assert.equal(priceLine(items[0]), "Сайт: 550 000 (сроки 2 мес)");
  assert.equal(priceLine(items[1]), "Чат-виджет: от 60 000");
  assert.equal(priceLine(items[2]), "SEO: 100 000 / месяц");
  assert.deepEqual(totalLines(items), ["Итого: от 610 000 рублей.", "Плюс ежемесячно: 100 000 рублей в месяц."]);
  assert.deepEqual(totalLines([item({ monthly: true, price: 21_000 })]), ["Итого в месяц: 21 000 рублей."]);
  assert.deepEqual(totalLines([item({ price: 1_001 })]), ["Итого: 1 001 рубль."]);

  const blocks = priceBlocks(items.slice(0, 1), "Рассрочка 50/50%\n\n");
  assert.deepEqual(blocks, [
    { marker: "1)", text: "Сайт: 550 000 (сроки 2 мес)", style: "regular" },
    null,
    { text: "Итого: 550 000 рублей.", style: "bold" },
    null,
    { text: "Рассрочка 50/50%", style: "italic" },
  ]);
});

test("перенос по словам и по буквам", () => {
  const fits = (s: string) => s.length <= 10;
  assert.deepEqual(wrap("один два три четыре", 10, fits), ["один два", "три четыре"]);
  assert.deepEqual(wrap("оченьдлинноеслово", 10, fits), ["оченьдлинн", "оеслово"]);
});

test("шрифт уменьшается, пока текст не влезет; длинный текст делится на слайды", () => {
  const measure = (s: string, _style: unknown, size: number) => s.length * size * 0.5;
  const short = fitText(textBlocks("Строка"), 600, 290, measure);
  assert.equal(short.size, 10);
  assert.equal(short.pages.length, 1);

  const twenty = textBlocks(Array.from({ length: 20 }, (_, i) => `${i + 1}. Пункт`).join("\n"));
  const fit = fitText(twenty, 600, 290, measure);
  assert.ok(fit.size < 10 && fit.size >= 7);
  assert.equal(fit.pages.length, 1);

  const many = textBlocks(Array.from({ length: 60 }, (_, i) => `${i + 1}. Пункт`).join("\n"));
  const split = fitText(many, 600, 290, measure);
  assert.equal(split.size, 7);
  assert.ok(split.pages.length >= 2);
  assert.equal(split.pages.flat().length, 60);
  assert.equal(split.pages[1][0].y, 0);
});

test("номера слайдов шаблона", () => {
  assert.deepEqual(parsePages("2-4, 7", 10), [2, 3, 4, 7]);
  assert.deepEqual(parsePages("2–3", 10), [2, 3]);
  assert.deepEqual(parsePages("", 10), []);
  assert.equal(parsePages("5-3", 10), null);
  assert.equal(parsePages("11", 10), null);
  assert.equal(parsePages("два", 10), null);
});

test("услуги из базы и из формы", () => {
  assert.deepEqual(parseItems([item({}), { title: "" }, "мусор"]), [item({})]);
  assert.deepEqual(parseItems(null), []);
  assert.equal(itemsSchema.safeParse([item({ title: " " })]).success, false);
  assert.equal(itemsSchema.safeParse([item({ price: 1.5 })]).success, false);
});

test("подписи: месяц на обложке, число слайдов и имя файла", () => {
  assert.deepEqual([1, 3, 11, 21, 25].map(slidesLabel), ["1 слайд", "3 слайда", "11 слайдов", "21 слайд", "25 слайдов"]);
  assert.equal(periodLabel(new Date("2026-11-07T12:00:00+03:00")), "Ноябрь, 2026");
  assert.equal(proposalFileName("Ромашка / пекарни", "Ноябрь, 2026"), "КП Ромашка пекарни Ноябрь, 2026.pdf");
});

test("PDF: обложка, слайды о студии, услуги, стоимость и контакты по порядку", async () => {
  const tpl = await PDFDocument.create();
  // Стандартный шрифт PDF без кириллицы: подписи слайдов латиницей
  for (let i = 0; i < 5; i++) tpl.addPage([720, 405]).drawText(`Slide ${i + 1}`, { x: 30, y: 380, size: 10 });
  const data = await tpl.save();
  const kp = {
    client: "Ромашка / пекарни",
    period: "Ноябрь, 2026",
    logo: null,
    items: [item({ text: "Этапы работы:\n1. Прототип" }), item({ title: "SEO", monthly: true })],
    note: "Рассрочка 50/50%",
  };
  const withTemplate = await PDFDocument.load(await buildProposalPdf(kp, { data, cover: 1, sample: 3, intro: [2, 3], outro: [5] }));
  // обложка + 2 о студии + 2 услуги + стоимость + контакты
  assert.equal(withTemplate.getPageCount(), 7);
  assert.equal(withTemplate.getTitle(), "Коммерческое предложение Ромашка / пекарни: Ноябрь, 2026");

  const bare = await PDFDocument.load(await buildProposalPdf(kp, null));
  assert.equal(bare.getPageCount(), 4);
});
