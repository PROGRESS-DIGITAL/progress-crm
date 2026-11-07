"use server";

import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
import { db } from "@/lib/db";
import { MAX_TEMPLATE_SIZE, TEMPLATE_ID } from "@/lib/proposals/store";
import { parsePages, slidesLabel } from "@/lib/proposals/text";

export type TemplateState = { error?: string; ok?: string } | undefined;

// Презентация студии в PDF. Номера слайдов сохраняются, если они есть в новом файле
export async function uploadTemplate(_prev: TemplateState, formData: FormData): Promise<TemplateState> {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Выберите PDF с презентацией" };
  if (file.size > MAX_TEMPLATE_SIZE) return { error: "Файл больше 25 МБ. Сохраните презентацию в PDF со сжатием картинок" };
  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") return { error: "Это не PDF. В Google Slides: Файл → Скачать → PDF" };
  let pages: number;
  try {
    pages = (await PDFDocument.load(data, { ignoreEncryption: true })).getPageCount();
  } catch {
    return { error: "Не получилось прочитать PDF. Попробуйте скачать презентацию в PDF заново" };
  }
  const current = await db.proposalTemplate.findUnique({ where: { id: TEMPLATE_ID }, select: { cover: true, sample: true, intro: true, outro: true } });
  const fits = (n: number | null) => n === null || n <= pages;
  const keep =
    current && fits(current.cover) && fits(current.sample) && parsePages(current.intro, pages) && parsePages(current.outro, pages);
  const slides = keep ? current : { cover: 1, sample: null, intro: "", outro: pages > 1 ? String(pages) : "" };
  const name = file.name.slice(0, 200) || "Шаблон КП.pdf";
  await db.proposalTemplate.upsert({
    where: { id: TEMPLATE_ID },
    create: { id: TEMPLATE_ID, name, size: file.size, data, pages, ...slides },
    update: { name, size: file.size, data, pages, ...slides },
  });
  revalidatePath("/price/kp");
  return {
    ok: keep
      ? `Загружено: ${slidesLabel(pages)}. Номера слайдов остались прежними, проверьте их ниже`
      : `Загружено: ${slidesLabel(pages)}. Теперь укажите ниже, какие слайды брать`,
  };
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

export async function saveTemplateSlides(_prev: TemplateState, formData: FormData): Promise<TemplateState> {
  const t = await db.proposalTemplate.findUnique({ where: { id: TEMPLATE_ID }, select: { pages: true } });
  if (!t) return { error: "Сначала загрузите презентацию" };
  const cover = num(formData.get("cover"));
  const sample = num(formData.get("sample"));
  const intro = String(formData.get("intro") ?? "").trim();
  const outro = String(formData.get("outro") ?? "").trim();
  const inRange = (n: number | null) => n !== null && Number.isInteger(n) && n >= 1 && n <= t.pages;
  if (!inRange(cover)) return { error: `Обложка — номер слайда от 1 до ${t.pages}` };
  if (sample !== null && !inRange(sample)) return { error: `Образец слайда услуги — номер от 1 до ${t.pages} или пусто` };
  if (!parsePages(intro, t.pages)) return { error: `Слайды о студии: номера от 1 до ${t.pages}, например «2-14»` };
  if (!parsePages(outro, t.pages)) return { error: `Слайды в конце: номера от 1 до ${t.pages}, например «${t.pages}»` };
  await db.proposalTemplate.update({ where: { id: TEMPLATE_ID }, data: { cover: cover!, sample, intro, outro } });
  revalidatePath("/price/kp");
  return { ok: "Сохранено" };
}

export async function deleteTemplate() {
  await db.proposalTemplate.deleteMany({ where: { id: TEMPLATE_ID } });
  revalidatePath("/price/kp");
}
