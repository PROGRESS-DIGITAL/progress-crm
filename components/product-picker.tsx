"use client";

import { useState } from "react";
import type { Service } from "@prisma/client";
import { SERVICE_LABELS, formatPrice } from "@/lib/format";
import type { ProductOption } from "@/lib/queries";
import { EditableAmount } from "@/components/editable-amount";
import { Field, inputClass } from "@/components/field";
import { SALES_STEPS } from "@/lib/sales-map";

export type ProductPickerValues = {
  productId: string;
  quantity: number;
  service: Service;
  amount: number;
  salesStep: string;
};

// Услуга из прайса подставляет направление и сумму (цена × количество); сумму можно поправить кликом
export function ProductPicker({
  products,
  initial,
  errors,
}: {
  products: ProductOption[];
  initial: ProductPickerValues;
  errors: Record<string, string>;
}) {
  const [productId, setProductId] = useState(initial.productId);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [service, setService] = useState<Service>(initial.service);
  const [amount, setAmount] = useState(initial.amount);
  const [salesStep, setSalesStep] = useState(initial.salesStep);
  const product = products.find((p) => p.id === productId);
  const categories = [...new Set(products.map((p) => p.category))];

  function choose(id: string, qty: number) {
    const p = products.find((x) => x.id === id);
    if (p) {
      setService(p.service);
      if (p.salesStep) setSalesStep(p.salesStep);
      setAmount(p.price * qty);
    }
  }

  return (
    <>
      <Field label="Услуга из прайса" error={errors.productId} wide>
        {/* select без value: управляемый select после ошибки React сбросил бы к первому пункту */}
        <select
          name="productId"
          defaultValue={initial.productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setQuantity(1);
            choose(e.target.value, 1);
          }}
          className={inputClass}
        >
          <option value="">Не из прайса</option>
          {categories.map((c) => (
            <optgroup key={c} label={c}>
              {products
                .filter((p) => p.category === c)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatPrice(p)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {product?.unit ? (
        <Field label={`Количество, ${product.unit}`} error={errors.quantity}>
          <input
            name="quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => {
              const q = Math.max(1, Math.round(Number(e.target.value) || 1));
              setQuantity(q);
              choose(productId, q);
            }}
            className={inputClass}
          />
        </Field>
      ) : (
        <input type="hidden" name="quantity" value={1} />
      )}
      <Field label="Направление" error={errors.service}>
        <select
          key={productId}
          name="service"
          defaultValue={service}
          onChange={(e) => setService(e.target.value as Service)}
          className={inputClass}
        >
          {Object.entries(SERVICE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Сумма, ₽" error={errors.amount}>
        <EditableAmount name="amount" value={amount} onChange={setAmount} />
      </Field>
      <Field label="Шаг планограммы" error={errors.salesStep}>
        <select
          key={`${productId}-${salesStep}`}
          name="salesStep"
          defaultValue={salesStep}
          onChange={(e) => setSalesStep(e.target.value)}
          className={inputClass}
        >
          <option value="">Не относится</option>
          {Object.entries(SALES_STEPS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
