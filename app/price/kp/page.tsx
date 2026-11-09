import Link from "next/link";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { getTemplateInfo } from "@/lib/proposals/store";
import { plural, slidesLabel } from "@/lib/proposals/text";
import { deleteTemplate } from "./actions";
import { TemplateSlidesForm, UploadTemplateForm } from "./template-form";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6";

// Шаблон КП: презентация студии, из которой в каждое КП попадают постоянные слайды
export default async function ProposalTemplatePage() {
  const [template, products, withText] = await Promise.all([
    getTemplateInfo(),
    db.product.count(),
    db.product.count({ where: { kpText: { not: null } } }),
  ]);

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <p className="text-sm">
        <Link href="/price" className="text-blue-600 hover:underline">
          ← Прайс
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Шаблон КП</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        КП собирается из сделки кнопкой «Собрать КП». Обложку с клиентом, слайд на каждую услугу и «Стоимость и сроки» CRM рисует сама в
        стиле вашей презентации, а слайды о студии и контакты берёт из неё без изменений.
      </p>

      <div className="flex flex-col gap-6">
        <section className={card}>
          <h2 className="font-semibold">1. Презентация студии</h2>
          {template ? (
            <div className="mt-2 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="min-w-0 truncate font-medium">{template.name}</span>
              <span className="text-slate-500">
                {slidesLabel(template.pages)} · {(template.size / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ · загружена{" "}
                {template.updatedAt.toLocaleDateString("ru-RU", { timeZone: TIME_ZONE })}
              </span>
              <ConfirmDeleteButton
                action={deleteTemplate}
                what="шаблон КП"
                message="Новые КП соберутся без слайдов о студии и контактов, пока не загрузите презентацию снова."
                icon
                label="Удалить шаблон КП"
              />
            </div>
          ) : (
            <p className="mt-1 mb-4 text-sm text-slate-500">
              Скачайте действующее КП из Google Slides в PDF (Файл → Скачать → PDF) и загрузите сюда.
            </p>
          )}
          <UploadTemplateForm replace={!!template} />
        </section>

        {template && (
          <section className={card}>
            <h2 className="font-semibold">2. Какие слайды брать</h2>
            <p className="mt-1 mb-4 text-sm text-slate-500">Номера слайдов как в презентации. Проверить результат можно на примере КП.</p>
            <TemplateSlidesForm
              key={`${template.name}-${template.size}-${template.pages}`}
              pages={template.pages}
              initial={{ cover: template.cover, sample: template.sample, intro: template.intro, outro: template.outro }}
            />
          </section>
        )}

        <section className={card}>
          <h2 className="font-semibold">{template ? "3" : "2"}. Тексты слайдов услуг</h2>
          <p className="mt-1 text-sm text-slate-500">
            «Этапы работы», «Состав проекта» и другой текст слайда задаются у услуги в{" "}
            <Link href="/price" className="text-blue-600 hover:underline">
              «Прайсе»
            </Link>{" "}
            карандашом слева. В КП текст можно поправить под клиента, в том числе с помощью Claude. Сейчас текст есть у {withText} из{" "}
            {products} {plural(products, "услуги", "услуг", "услуг")}.
          </p>
        </section>
      </div>
    </div>
  );
}
