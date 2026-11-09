import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFEmbeddedPage, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fitText, priceBlocks, textBlocks, wrap, type Block, type ProposalItem, type Style } from "./text";

// Сборка КП в PDF. Слайды о студии и контакты копируются из шаблона как есть, а обложка, слайды услуг
// и «Стоимость и сроки» рисуются заново в той же сетке: координаты сняты со слайдов шаблона 720 × 405 pt.
// Шрифт — Liberation Sans (метрики Arial), лицензия OFL в lib/proposals/fonts

export type ProposalTemplateInput = {
  data: Uint8Array;
  cover: number;
  sample: number | null;
  intro: number[];
  outro: number[];
};

export type ProposalInput = {
  client: string;
  period: string;
  logo: { data: Uint8Array; mime: string } | null;
  items: ProposalItem[];
  note: string | null;
};

const BASE_W = 720;
const BASE_H = 405;
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const FONT_DIR = path.join(process.cwd(), "lib/proposals/fonts");
const FONT_FILES: Record<Style, string> = {
  regular: "LiberationSans-Regular.ttf",
  bold: "LiberationSans-Bold.ttf",
  italic: "LiberationSans-Italic.ttf",
};

let fontBytes: Promise<Record<Style, Uint8Array>> | null = null;
function loadFonts() {
  fontBytes ??= Promise.all(
    (Object.entries(FONT_FILES) as [Style, string][]).map(async ([style, file]) => [style, await readFile(path.join(FONT_DIR, file))] as const),
  ).then((list) => Object.fromEntries(list) as unknown as Record<Style, Uint8Array>);
  return fontBytes;
}

// Области шаблона в долях слайда: левая часть обложки с логотипом студии, шапка и подвал слайда услуги
const COVER_LEFT = { right: 135 };
const HEADER = { right: 260, bottom: 36 };
const FOOTER = { right: 260, top: 374 };

export async function buildProposalPdf(kp: ProposalInput, template: ProposalTemplateInput | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = await loadFonts();
  const fonts = {} as Record<Style, PDFFont>;
  for (const style of Object.keys(FONT_FILES) as Style[]) fonts[style] = await doc.embedFont(bytes[style], { subset: true });

  const src = template ? await PDFDocument.load(template.data, { ignoreEncryption: true }) : null;
  const srcPage = (n: number | null) => (src && n && n >= 1 && n <= src.getPageCount() ? src.getPage(n - 1) : null);
  const first = srcPage(1);
  const W = first?.getWidth() ?? BASE_W;
  const H = first?.getHeight() ?? BASE_H;
  const sx = W / BASE_W;
  const sy = H / BASE_H;
  // Координата по вертикали в шаблоне считается от верха слайда, в PDF — от низа
  const top = (y: number) => H - y * sy;

  const text = (page: PDFPage, s: string, x: number, baseline: number, size: number, style: Style, color = BLACK) =>
    page.drawText(s, { x: x * sx, y: top(baseline), size: size * sy, font: fonts[style], color });
  const width = (s: string, style: Style, size: number) => fonts[style].widthOfTextAtSize(s, size);
  // Часть слайда шаблона; пустой слайд встроить нельзя — тогда без неё
  const embed = (page: PDFPage, box: { left: number; bottom: number; right: number; top: number }) =>
    doc.embedPage(page, box).catch(() => null);

  // ——— Обложка ———
  const cover = doc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BLACK });
  const coverSrc = srcPage(template?.cover ?? null);
  const left = coverSrc && (await embed(coverSrc, { left: 0, bottom: 0, right: COVER_LEFT.right * sx, top: H }));
  if (left) cover.drawPage(left, { x: 0, y: 0 });
  let textX = 158;
  if (kp.logo) {
    const image = kp.logo.mime === "image/png" ? await doc.embedPng(kp.logo.data) : await doc.embedJpg(kp.logo.data);
    // Логотип вписывается в рамку шаблона 205 × 130 pt
    const box = { x: 158, y: 137, w: 205, h: 130 };
    const k = Math.min(box.w / image.width, box.h / image.height);
    const w = image.width * k;
    const h = image.height * k;
    cover.drawImage(image, { x: (box.x + (box.w - w) / 2) * sx, y: top(box.y + (box.h + h) / 2), width: w * sx, height: h * sy });
    textX = 427;
  }
  {
    const maxW = BASE_W - textX - 30;
    let size = 13.3;
    while (size > 9 && width(kp.client, "bold", size) > maxW * 2) size -= 0.5;
    const clientLines = wrap(kp.client, maxW, (s) => width(s, "bold", size) <= maxW).slice(0, 3);
    let y = 179.5;
    for (const l of clientLines) {
      text(cover, l, textX, y, size, "bold", WHITE);
      y += size * 1.2;
    }
    y += 39 - 16;
    text(cover, "Коммерческое предложение", textX, y, 13.3, "bold", WHITE);
    text(cover, kp.period, textX, y + 19.5, 13.3, "regular", WHITE);
  }

  // ——— Слайды о студии ———
  const copy = async (pages: number[]) => {
    if (!src) return;
    const valid = pages.filter((p) => p >= 1 && p <= src.getPageCount()).map((p) => p - 1);
    for (const p of await doc.copyPages(src, valid)) doc.addPage(p);
  };
  await copy(template?.intro ?? []);

  // Шапка и подвал слайдов услуг — с образца в шаблоне
  const sample = srcPage(template?.sample ?? null);
  let header: PDFEmbeddedPage | null = null;
  let footer: PDFEmbeddedPage | null = null;
  if (sample) {
    header = await embed(sample, { left: 0, bottom: top(HEADER.bottom), right: HEADER.right * sx, top: H });
    footer = await embed(sample, { left: 0, bottom: 0, right: FOOTER.right * sx, top: top(FOOTER.top) });
  }

  const BODY = { marker: 33, x: 61, right: 670, top: 82, bottom: 372 };
  const contentSlide = (n: number, title: string, blocks: Block[]) => {
    const fit = fitText(blocks, BODY.right - BODY.x, BODY.bottom - BODY.top, width);
    fit.pages.forEach((lines, part) => {
      const page = doc.addPage([W, H]);
      page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: WHITE });
      if (header) page.drawPage(header, { x: 0, y: top(HEADER.bottom) });
      if (footer) page.drawPage(footer, { x: 0, y: 0 });
      const num = String(doc.getPageCount());
      text(page, num, 696.5 - width(num, "regular", 6), 24, 6, "regular");

      const heading = part ? `${title} (продолжение)` : title;
      let size = 12;
      while (size > 8 && width(heading, "bold", size) > BASE_W - 57 - 40) size -= 0.5;
      text(page, `${n}.`, 21, 61, size, "bold");
      text(page, heading, 57, 61, size, "bold");

      const ascent = fit.size * 0.905;
      for (const l of lines) {
        const baseline = BODY.top + l.y + ascent;
        if (l.marker) text(page, l.marker, BODY.marker, baseline, fit.size, "regular");
        text(page, l.text, BODY.x, baseline, fit.size, l.style);
      }
    });
  };

  kp.items.forEach((item, i) => contentSlide(i + 1, item.title, textBlocks(item.text)));
  contentSlide(kp.items.length + 1, "Стоимость и сроки", priceBlocks(kp.items, kp.note));

  // ——— Контакты и всё, что в конце ———
  await copy(template?.outro ?? []);

  doc.setTitle(`Коммерческое предложение ${kp.client}: ${kp.period}`);
  return doc.save();
}
