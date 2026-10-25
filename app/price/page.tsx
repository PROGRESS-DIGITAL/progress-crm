import { db } from "@/lib/db";
import { sortByCategory } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { deleteProduct } from "./actions";
import { PriceEditor } from "./price-editor";
import { TextEditor } from "./text-editor";
import { StepSelect } from "./step-select";
import { ProductForm } from "./product-form";
import { ProductRow } from "./product-row";

export const dynamic = "force-dynamic";

export default async function PricePage() {
  const products = sortByCategory(
    await db.product.findMany({ include: { _count: { select: { deals: true } } } }),
  );
  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Прайс</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Услуги для выбора в сделке. Название, описание и цену можно изменить кликом, всё остальное — карандашом слева; сумма в уже созданных сделках при этом не меняется. Шаг планограммы связывает услугу со схемой продаж.
      </p>

      <div className="flex flex-col gap-6">
        {categories.map((c) => (
          <section key={c} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold">{c}</h2>
            <ul className="divide-y divide-slate-100">
              {products
                .filter((p) => p.category === c)
                .map((p) => (
                  <ProductRow
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    categories={categories}
                    product={{
                      category: p.category,
                      name: p.name,
                      description: p.description,
                      price: p.price,
                      unit: p.unit,
                      service: p.service,
                      salesStep: p.salesStep,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <TextEditor id={p.id} field="name" value={p.name} className="text-sm font-medium" placeholder="Название" />
                      <TextEditor
                        id={p.id}
                        field="description"
                        value={p.description}
                        className="text-xs text-slate-500"
                        placeholder="Добавить описание"
                      />
                    </div>
                    <span className="hidden text-xs text-slate-400 sm:block">
                      {p._count.deals > 0 ? `сделок: ${p._count.deals}` : ""}
                    </span>
                    <StepSelect id={p.id} value={p.salesStep} />
                    <PriceEditor id={p.id} price={p.price} unit={p.unit} />
                    <ConfirmDeleteButton
                      action={deleteProduct.bind(null, p.id)}
                      message={`Удалить «${p.name}» из прайса? Сделки с этой услугой сохранятся.`}
                      label="×"
                    />
                  </ProductRow>
                ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Новая услуга</h2>
        <ProductForm categories={categories} />
      </section>
    </div>
  );
}
