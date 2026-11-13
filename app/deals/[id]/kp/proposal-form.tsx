"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileDrop } from "@/components/file-drop";
import { Field, inputClass, primaryButton } from "@/components/field";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { formatPrice } from "@/lib/format";
import { totalLines, type ProposalItem } from "@/lib/proposals/text";
import { adaptSlideText, saveProposal } from "./actions";

export type PriceProduct = { id: string; category: string; name: string; price: number; unit: string | null; kpText: string | null };

type Row = ProposalItem & { key: number; before?: string };

const smallButton = "rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40";

// Форма КП: обложка, услуги со слайдами и ценами, примечание под итогом. Сохраняет и сразу скачивает PDF
export function ProposalForm({
  dealId,
  proposalId,
  initial,
  products,
  logoFrom,
  hasLogo,
}: {
  dealId: string;
  proposalId: string | null;
  initial: { client: string; period: string; note: string; items: ProposalItem[] };
  products: PriceProduct[];
  // КП, из которого взять логотип клиента, если новый не загрузили
  logoFrom: string | null;
  hasLogo: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const nextKey = useRef(initial.items.length);
  const [rows, setRows] = useState<Row[]>(initial.items.map((it, key) => ({ ...it, key })));
  const [client, setClient] = useState(initial.client);
  const [adapting, setAdapting] = useState<number | null>(null);
  const [adaptError, setAdaptError] = useState<{ key: number; text: string } | null>(null);
  const [, startTransition] = useTransition();
  const [state, action, pending] = useActionState(saveProposal.bind(null, dealId, proposalId), undefined);
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    if (!state?.id) return;
    const a = document.createElement("a");
    a.href = `/deals/${dealId}/kp/${state.id}/pdf?download`;
    a.download = "";
    a.click();
    router.push(`/deals/${dealId}#kp`);
  }, [state, dealId, router]);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (item: ProposalItem) => setRows((rs) => [...rs, { ...item, key: nextKey.current++ }]);
  const move = (index: number, delta: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [r] = next.splice(index, 1);
      next.splice(index + delta, 0, r);
      return next;
    });

  function addProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    add({ productId: p.id, title: p.name, text: p.kpText ?? "", price: p.price, from: false, monthly: /^мес/i.test(p.unit?.trim() ?? ""), note: "" });
  }

  function adapt(row: Row) {
    setAdapting(row.key);
    setAdaptError(null);
    startTransition(async () => {
      const r = await adaptSlideText(dealId, { title: row.title, text: row.text, client });
      setAdapting(null);
      if (r.text) update(row.key, { text: r.text, before: row.text });
      else setAdaptError({ key: row.key, text: r.error ?? "Не получилось" });
    });
  }

  const categories = [...new Set(products.map((p) => p.category))];
  const items: ProposalItem[] = rows.map(({ key: _key, before: _before, ...it }) => it);
  const totals = totalLines(items);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {logoFrom && <input type="hidden" name="reuseLogo" value={logoFrom} />}

      <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
        <h2 className="mb-4 font-semibold">Обложка</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Клиент / отрасль">
            <input name="client" value={client} onChange={(e) => setClient(e.target.value)} required maxLength={200} className={inputClass} />
            <span className="text-xs text-slate-500">Например: «Ромашка / оборудование для пекарен»</span>
          </Field>
          <Field label="Месяц, год">
            <input name="period" defaultValue={initial.period} required maxLength={60} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <FileDrop compact hint="Отпустите, чтобы загрузить логотип" wrongType="Нужна картинка PNG или JPEG" className="-m-2 rounded-xl p-2">
              <Field label="Логотип клиента, PNG или JPEG">
                <input
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="min-w-0 max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
                />
                <span className="text-xs text-slate-500">
                  {hasLogo
                    ? "Логотип уже есть. Загрузите новый, чтобы заменить."
                    : "Необязательно: без логотипа название клиента встанет на его место."}
                </span>
              </Field>
            </FileDrop>
            {hasLogo && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="removeLogo" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} />
                Убрать логотип
              </label>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-semibold">Услуги</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          На каждую услугу — свой слайд. Строка с двоеточием в конце станет подзаголовком, «1.» и «•» — пунктами списка.
        </p>
        <ol className="flex flex-col gap-4">
          {rows.map((r, i) => (
            <li key={r.key} className="rounded-xl border border-slate-200 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 shrink-0 text-sm font-semibold text-slate-500 tabular-nums">{i + 1}.</span>
                <input
                  aria-label="Название услуги на слайде"
                  value={r.title}
                  onChange={(e) => update(r.key, { title: e.target.value })}
                  required
                  maxLength={200}
                  className={`${inputClass} min-w-0 flex-1 basis-56 font-medium`}
                />
                <div className="ml-auto flex shrink-0 items-center">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={smallButton} aria-label="Выше">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className={smallButton} aria-label="Ниже">
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Убрать «${r.title}»`}
                    title="Убрать из КП"
                    onClick={async () => {
                      if (await confirm({ title: `Вы точно хотите удалить услугу «${r.title || "без названия"}» из КП?` }))
                        setRows((rs) => rs.filter((x) => x.key !== r.key));
                    }}
                    className={`${smallButton} hover:text-rose-600`}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>

              <textarea
                aria-label="Текст слайда"
                value={r.text}
                onChange={(e) => update(r.key, { text: e.target.value, before: undefined })}
                rows={Math.min(14, Math.max(5, r.text.split("\n").length + 1))}
                placeholder={"Этапы работы:\n1. …\n\nСостав проекта:\n• …"}
                className={`${inputClass} mt-3`}
              />
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <button
                  type="button"
                  onClick={() => adapt(r)}
                  disabled={adapting !== null}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline disabled:opacity-60"
                >
                  <Icon name="spark" size={14} />
                  {adapting === r.key ? "Claude переписывает…" : r.text.trim() ? "Подогнать под клиента" : "Написать с Claude"}
                </button>
                {r.before !== undefined && (
                  <button type="button" onClick={() => update(r.key, { text: r.before, before: undefined })} className="text-slate-600 hover:underline">
                    Вернуть как было
                  </button>
                )}
                {adaptError?.key === r.key && <span className="text-rose-600">{adaptError.text}</span>}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[10rem_auto_minmax(0,1fr)] sm:items-end">
                <Field label="Цена, ₽">
                  <input
                    inputMode="numeric"
                    value={r.price ? r.price.toLocaleString("ru-RU") : ""}
                    onChange={(e) => update(r.key, { price: Math.min(1_000_000_000, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                    className={`${inputClass} tabular-nums`}
                  />
                </Field>
                <div className="flex flex-col justify-end gap-1 pb-1 text-sm text-slate-700">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={r.from} onChange={(e) => update(r.key, { from: e.target.checked })} />
                    «от»
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={r.monthly} onChange={(e) => update(r.key, { monthly: e.target.checked })} />
                    в месяц
                  </label>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Field label="В скобках после цены">
                    <input
                      value={r.note}
                      onChange={(e) => update(r.key, { note: e.target.value })}
                      maxLength={200}
                      placeholder="сроки 2 мес"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value=""
            onChange={(e) => addProduct(e.target.value)}
            aria-label="Добавить услугу из прайса"
            className={`${inputClass} w-auto max-w-full`}
          >
            <option value="">+ Добавить услугу из прайса</option>
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
          <button
            type="button"
            onClick={() => add({ productId: null, title: "", text: "", price: 0, from: false, monthly: false, note: "" })}
            className="text-sm text-blue-600 hover:underline"
          >
            + Своя услуга
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-semibold">Стоимость и сроки</h2>
        <p className="mt-1 text-sm text-slate-500">Слайд собирается из услуг выше. Итог:</p>
        <p className="mt-2 text-sm font-semibold">{totals.length ? totals.join(" ") : "добавьте услуги"}</p>
        <div className="mt-4">
          <Field label="Под итогом">
            <textarea name="note" defaultValue={initial.note} rows={2} maxLength={1000} placeholder="Рассрочка платежей 50/50%" className={inputClass} />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !rows.length} className={primaryButton}>
          {pending ? "Собираю КП…" : "Сохранить и скачать PDF"}
        </button>
        <Link href={`/deals/${dealId}#kp`} className="text-sm text-slate-600 hover:text-slate-900">
          Отмена
        </Link>
        {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      </div>
    </form>
  );
}
