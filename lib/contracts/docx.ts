import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import { parse, NodeType, type HTMLElement, type Node } from "node-html-parser";

// Договор в настоящий .docx: открывается в Word, Pages, Google Документах и LibreOffice.
// Понимает то, что умеет редактор CRM и что приходит из Word: абзацы, заголовки, списки, таблицы, картинки

type Style = { bold?: boolean; italics?: boolean; underline?: boolean };
type Block = Paragraph | Table;
type Ctx = { inTable: boolean; lists: number; align?: (typeof ALIGN)[string] };

const FONT = "Calibri";
const SIZE = 22; // полупункты: 11 pt
const PAGE_WIDTH_PX = 680; // ширина текста на листе A4 с полями 2 и 1,5 см, в пикселях

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

function styleOf(el: HTMLElement, prop: string) {
  return el.getAttribute("style")?.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"))?.[1].trim().toLowerCase();
}

function alignOf(el: HTMLElement) {
  const a = styleOf(el, "text-align") ?? el.getAttribute("align")?.toLowerCase();
  return a ? ALIGN[a] : undefined;
}

// Размер картинки из заголовка файла: PNG, JPEG или GIF
function imageSize(buf: Buffer): { w: number; h: number; type: "png" | "jpg" | "gif" } | null {
  if (buf.subarray(1, 4).toString() === "PNG") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: "png" };
  if (buf.subarray(0, 3).toString() === "GIF") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8), type: "gif" };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i < buf.length - 9; ) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), type: "jpg" };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

function image(el: HTMLElement): ImageRun | null {
  const m = el.getAttribute("src")?.match(/^data:image\/[a-z]+;base64,(.+)$/i);
  if (!m) return null;
  const data = Buffer.from(m[1], "base64");
  const size = imageSize(data);
  if (!size || !size.w || !size.h) return null;
  const maxH = Number.parseInt(styleOf(el, "max-height") ?? "", 10);
  let scale = Math.min(1, PAGE_WIDTH_PX / size.w);
  if (maxH) scale = Math.min(scale, maxH / size.h);
  return new ImageRun({ type: size.type, data, transformation: { width: Math.round(size.w * scale), height: Math.round(size.h * scale) } });
}

function inline(node: Node, style: Style, out: ParagraphChild[]) {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = node.text.replace(/\s+/g, " ");
    if (text) out.push(new TextRun({ text, ...style } as IRunOptions));
    return;
  }
  if (node.nodeType !== NodeType.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase();
  if (tag === "br") return void out.push(new TextRun({ break: 1 }));
  if (tag === "img") {
    const img = image(el);
    if (img) out.push(img);
    return;
  }
  const next = { ...style };
  if (tag === "strong" || tag === "b" || /bold|[6-9]00/.test(styleOf(el, "font-weight") ?? "")) next.bold = true;
  if (tag === "em" || tag === "i" || styleOf(el, "font-style") === "italic") next.italics = true;
  if (tag === "u" || styleOf(el, "text-decoration")?.includes("underline")) next.underline = true;
  for (const child of el.childNodes) inline(child, next, out);
}

function runs(el: HTMLElement, style: Style = {}) {
  const out: ParagraphChild[] = [];
  for (const child of el.childNodes) inline(child, style, out);
  return out;
}

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "hr", "blockquote", "section"]);

function paragraph(el: HTMLElement, ctx: Ctx, extra: Partial<ConstructorParameters<typeof Paragraph>[0] & object> = {}) {
  const tag = el.tagName.toLowerCase();
  const heading = /^h[1-6]$/.test(tag);
  const pageBreak = el.classList?.contains("page-break") || /always|page/.test(styleOf(el, "page-break-before") ?? styleOf(el, "break-before") ?? "");
  const children = runs(el, heading ? { bold: true } : {});
  return new Paragraph({
    children,
    alignment: alignOf(el) ?? ctx.align ?? (heading || ctx.inTable ? AlignmentType.LEFT : AlignmentType.JUSTIFIED),
    spacing: { after: heading ? 120 : 60, before: heading ? 200 : 0 },
    pageBreakBefore: pageBreak || undefined,
    ...extra,
  });
}

function blocks(parent: HTMLElement, ctx: Ctx): Block[] {
  const out: Block[] = [];
  let loose: HTMLElement | null = null;
  // Текст и строчные теги вне абзаца собираем в один абзац
  const flush = () => {
    if (loose && (loose.text.trim() || loose.querySelector("img"))) out.push(paragraph(loose, ctx));
    loose = null;
  };
  for (const node of parent.childNodes) {
    const el = node as HTMLElement;
    const tag = node.nodeType === NodeType.ELEMENT_NODE ? el.tagName.toLowerCase() : "";
    if (!BLOCK_TAGS.has(tag)) {
      if (node.nodeType === NodeType.TEXT_NODE && !node.text.trim() && !loose) continue;
      loose ??= parse("<p></p>").firstChild as HTMLElement;
      loose.appendChild(node.clone());
      continue;
    }
    flush();
    if (tag === "hr") {
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.DASHED, size: 6, color: "666666", space: 1 } }, spacing: { after: 160 } }));
    } else if (tag === "ul" || tag === "ol") {
      const instance = ++ctx.lists;
      for (const li of el.childNodes) {
        if (li.nodeType !== NodeType.ELEMENT_NODE || (li as HTMLElement).tagName.toLowerCase() !== "li") continue;
        out.push(
          paragraph(li as HTMLElement, ctx, {
            numbering: { reference: tag === "ol" ? "ordered" : "bullets", level: 0, instance },
          }),
        );
      }
    } else if (tag === "table") {
      out.push(table(el, ctx));
    } else if (tag === "div" || tag === "section" || tag === "blockquote") {
      out.push(...blocks(el, ctx));
    } else {
      out.push(paragraph(el, ctx));
    }
  }
  flush();
  return out;
}

function table(el: HTMLElement, ctx: Ctx) {
  const plain = el.classList.contains("contract-plain");
  const rows = el.querySelectorAll("tr").filter((tr) => tr.closest("table") === el);
  const cols = Math.max(1, ...rows.map((r) => r.childNodes.filter((c) => /^t[dh]$/i.test((c as HTMLElement).tagName ?? "")).length));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: plain ? NO_BORDERS : undefined,
    rows: rows.map(
      (tr) =>
        new TableRow({
          children: tr.childNodes
            .filter((c): c is HTMLElement => /^t[dh]$/i.test((c as HTMLElement).tagName ?? ""))
            .map((td) => {
              const width = Number.parseFloat(styleOf(td, "width") ?? "") || 100 / cols;
              const content = blocks(td, { ...ctx, inTable: true, align: alignOf(td) });
              return new TableCell({
                width: { size: width, type: WidthType.PERCENTAGE },
                columnSpan: Number(td.getAttribute("colspan")) || undefined,
                margins: plain ? { left: 0, right: 120 } : { left: 80, right: 80, top: 40, bottom: 40 },
                children: content.length ? content : [new Paragraph({})],
              });
            }),
        }),
    ),
  });
}

export async function contractToDocx(title: string, html: string) {
  const root = parse(`<div>${html}</div>`).firstChild as HTMLElement;
  const children = blocks(root, { inTable: false, lists: 0 });
  const doc = new Document({
    title,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
        },
        {
          reference: "ordered",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 850 } } },
        children: children.length ? children : [new Paragraph({})],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
