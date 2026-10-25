"use client";

import { useState } from "react";
import { ProductForm, type ProductValues } from "./product-form";
import { updateProduct } from "./actions";

// Строка прайса: карандаш открывает правку всей услуги на месте строки
export function ProductRow({
  id,
  name,
  product,
  categories,
  children,
}: {
  id: string;
  name: string;
  product: ProductValues;
  categories: string[];
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li data-testid={`product-${name}`} className="bg-blue-50/40 px-4 py-4">
        <ProductForm
          categories={categories}
          action={updateProduct.bind(null, id)}
          initial={product}
          submitLabel="Сохранить"
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li data-testid={`product-${name}`} className="flex items-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Изменить услугу"
        aria-label={`Изменить «${name}»`}
        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path d="M13.6 2.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8l-9.5 9.5-4.2 1.3a.6.6 0 0 1-.7-.7l1.3-4.2 9.3-9.7Zm-1 3.2-7.4 7.5-.7 2.3 2.3-.7 7.4-7.5-1.6-1.6Z" />
        </svg>
      </button>
      {children}
    </li>
  );
}
