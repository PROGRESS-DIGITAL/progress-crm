"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { Icon } from "@/components/icons";
import { primaryButton } from "@/components/field";
import { formatRub } from "@/lib/format";
import {
  MAX_SCENARIOS,
  computeFinModel,
  finModelFromTable,
  newId,
  parseNumberCell,
  type FinModel,
} from "@/lib/finmodel";
import { readFinModelFile, saveFinModel } from "./actions";

type FactMonth = { label: string; revenue: number; bank: number };

const fmt = (n: number) => (n ? Math.round(n).toLocaleString("ru-RU") : "—");
const rub = (n: number) => formatRub(Math.round(n));

// Ячейка с числом как в таблице: при вводе — голое число, после — с разрядами
function NumberInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      value={text ?? (value ? value.toLocaleString("ru-RU") : "")}
      placeholder="0"
      onFocus={(e) => {
        setText(value ? String(value) : "");
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(Math.max(0, parseNumberCell(e.target.value) ?? 0));
      }}
      onBlur={() => setText(null)}
      className="w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right tabular-nums outline-none placeholder:text-slate-300 hover:border-slate-200 focus:border-blue-500 focus:bg-white"
    />
  );
}

function TextInput({ value, onChange, label, bold }: { value: string; onChange: (v: string) => void; label: string; bold?: boolean }) {
  return (
    <input
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1.5 outline-none hover:border-slate-200 focus:border-blue-500 focus:bg-white ${bold ? "font-semibold" : ""}`}
    />
  );
}

const stickyCell = "sticky left-0 z-10 bg-white";

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rounded-md p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600">
      <Icon name="close" size={14} />
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
      <Icon name="plus" size={14} />
      {label}
    </button>
  );
}

// Где факт месяца относительно сценариев: какой уровень уже взят и сколько до следующего
function FactScale({ fact, scenarios, revenue }: { fact: FactMonth; scenarios: string[]; revenue: number[] }) {
  const levels = scenarios.map((name, i) => ({ name, value: revenue[i] })).filter((l) => l.value > 0).sort((a, b) => a.value - b.value);
  const max = Math.max(1, fact.revenue, ...levels.map((l) => l.value));
  const reached = [...levels].reverse().find((l) => fact.revenue >= l.value);
  const next = levels.find((l) => fact.revenue < l.value);
  return (
    <div>
      <div className="relative mt-3 h-3 rounded-full bg-slate-100">
        <div className="grow-x absolute inset-y-0 left-0 rounded-full bg-blue-500" style={{ width: `${(fact.revenue / max) * 100}%` }} />
        {levels.map((l) => (
          <span
            key={l.name}
            title={`${l.name}: ${rub(l.value)}`}
            className="absolute -top-1 h-5 w-0.5 rounded-full bg-slate-400"
            style={{ left: `calc(${(l.value / max) * 100}% - 1px)` }}
          />
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {reached ? (
          <>
            Уровень «<span className="font-medium text-slate-900">{reached.name}</span>» взят.
          </>
        ) : levels.length ? (
          "Пока ниже минимального сценария."
        ) : (
          "Заполните модель, чтобы сравнивать с планом."
        )}
        {next && ` До «${next.name}» не хватает ${rub(next.value - fact.revenue)}.`}
      </p>
    </div>
  );
}

export function FinModelEditor({
  initial,
  isNew,
  fact,
}: {
  initial: FinModel;
  isNew: boolean;
  fact: { current: FactMonth; previous: FactMonth };
}) {
  const confirm = useConfirm();
  const [model, setModel] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(model) !== saved;
  const t = computeFinModel(model);
  const n = model.scenarios.length;
  const cols = Array.from({ length: n }, (_, i) => i);

  // Несохранённые правки не теряются при закрытии вкладки
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(fn: (d: FinModel) => void) {
    setNotice(null);
    setModel((m) => {
      const d = structuredClone(m);
      fn(d);
      return d;
    });
  }

  async function remove(what: string, fn: (d: FinModel) => void) {
    if (await confirm({ title: `Вы точно хотите удалить ${what}?` })) update(fn);
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await saveFinModel(model);
      if (r.error) return setError(r.error);
      setSaved(JSON.stringify(model));
      setNotice("Сохранено");
    });
  }

  function loaded(m: FinModel) {
    setModel(m);
    setImportOpen(false);
    setPasted("");
    setError(null);
    setNotice("Таблица загружена. Проверьте цифры и нажмите «Сохранить»");
  }

  function importText() {
    const m = finModelFromTable(pasted);
    if (!m.services.length && !m.costs.length) return setError("В тексте не нашлось блоков «Кол-во клиентов», «Средний чек» или «Затраты»");
    loaded(m);
  }

  function importFile(file: File | undefined) {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    start(async () => {
      const r = await readFinModelFile(data);
      if (r.error || !r.model) return setError(r.error ?? "Не получилось прочитать файл");
      loaded(r.model);
    });
  }

  // Название блока и кнопка добавления живут в закреплённом первом столбце, чтобы на телефоне не уезжать при прокрутке
  const sectionRow = (title: string, action?: React.ReactNode) => (
    <tr>
      <td className="sticky left-0 z-10 bg-slate-50 px-3 pt-4 pb-2">
        <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</span>
        {action && <span className="-ml-2 mt-1 block">{action}</span>}
      </td>
      <td colSpan={n + 1} className="bg-slate-50" />
    </tr>
  );

  const totalRow = (label: string, values: number[], tone = "") => (
    <tr className="font-semibold">
      <td className={`${stickyCell} border-t border-slate-200 px-3 py-2 ${tone}`}>{label}</td>
      {cols.map((i) => (
        <td key={i} className={`border-t border-slate-200 px-3 py-2 text-right tabular-nums ${tone}`}>
          {fmt(values[i])}
        </td>
      ))}
      <td className="border-t border-slate-200" />
    </tr>
  );

  return (
    <div>
      <p className="mb-6 text-sm text-slate-600">
        План студии по сценариям: клиенты и средний чек по направлениям, затраты и налог. Выручка, итоги и прибыль считаются сами.
        Факт — оплаченные сделки за месяц.
      </p>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <div className="grid gap-6 lg:grid-cols-2">
          {[fact.current, fact.previous].map((f, k) => (
            <div key={f.label}>
              <p className="text-sm font-medium text-slate-700">
                Факт · {f.label}
                {k === 0 && <span className="font-normal text-slate-500"> (месяц ещё идёт)</span>}
              </p>
              <p className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums">{rub(f.revenue)}</p>
              <p className="text-xs text-slate-500">по оплаченным сделкам · на счёт пришло {rub(f.bank)}</p>
              <FactScale fact={f} scenarios={model.scenarios} revenue={t.revenue} />
            </div>
          ))}
        </div>
      </section>

      <div className={`mb-6 grid grid-cols-2 gap-3 sm:gap-4 ${n >= 4 ? "xl:grid-cols-4" : n === 3 ? "xl:grid-cols-3" : ""}`}>
        {cols.map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card sm:p-5">
            <p className="truncate text-sm font-medium text-slate-700">{model.scenarios[i] || `Сценарий ${i + 1}`}</p>
            <p className={`mt-2 text-lg font-semibold sm:mt-3 sm:text-[26px] tracking-tight tabular-nums ${t.profit[i] < 0 ? "text-rose-600" : ""}`}>{rub(t.profit[i])}</p>
            <p className="text-xs text-slate-500">прибыль в месяц{t.margin[i] !== null && ` · рентабельность ${t.margin[i]}%`}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
              <dt className="text-slate-500">Выручка</dt>
              <dd className="text-right tabular-nums">{rub(t.revenue[i])}</dd>
              <dt className="text-slate-500">Затраты</dt>
              <dd className="text-right tabular-nums">{rub(t.costs[i] + t.tax[i])}</dd>
            </dl>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200/60 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold">Модель</h2>
            <p className="mt-0.5 text-xs text-slate-500" aria-live="polite">
              {dirty ? "Есть несохранённые изменения" : (notice ?? "Нажмите на ячейку, чтобы изменить")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <Icon name="document" size={16} />
              Загрузить из Excel
            </button>
            {dirty && (
              <button
                type="button"
                onClick={async () => {
                  if (await confirm({ title: "Отменить несохранённые изменения?", ok: "Отменить изменения" })) setModel(JSON.parse(saved));
                }}
                className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Отменить
              </button>
            )}
            <button type="button" onClick={save} disabled={!dirty || busy} className={primaryButton}>
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        </div>

        {(isNew && !dirty && !importOpen) && (
          <p className="mx-5 mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Это пустой шаблон. Загрузите свою финмодель из Excel или заполните ячейки вручную.
          </p>
        )}
        {error && <p className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        {importOpen && (
          <div className="mx-5 mt-4 rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-700">
              Выберите файл .xlsx или скопируйте ячейки таблицы в Excel либо Google Таблицах и вставьте ниже. Нынешняя модель
              заменится, но сохранится только после «Сохранить».
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
              >
                <Icon name="clip" size={16} />
                {busy ? "Читаю файл…" : "Выбрать файл .xlsx"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(e) => {
                  importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={6}
              placeholder="…или вставьте сюда ячейки из таблицы"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-500"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={importText} disabled={!pasted.trim()} className={primaryButton}>
                Загрузить текст
              </button>
              <button type="button" onClick={() => setImportOpen(false)} className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Закрыть
              </button>
            </div>
          </div>
        )}

        <div className="mt-2 overflow-x-auto pb-3">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm" style={{ minWidth: 190 + n * 125 }}>
            <colgroup>
              <col className="w-36 sm:w-64" />
              {cols.map((i) => (
                <col key={i} />
              ))}
              <col className="w-10" />
            </colgroup>
            <thead>
              <tr>
                <th className={`${stickyCell} px-3 py-2 text-left text-xs font-medium text-slate-500`}>Сценарий</th>
                {cols.map((i) => (
                  <th key={i} className="px-1 py-2">
                    <div className="flex items-center gap-0.5">
                      <input
                        value={model.scenarios[i]}
                        aria-label={`Название сценария ${i + 1}`}
                        onChange={(e) => update((d) => void (d.scenarios[i] = e.target.value))}
                        className="w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right font-semibold outline-none hover:border-slate-200 focus:border-blue-500 focus:bg-white"
                      />
                      {n > 1 && (
                        <RemoveButton
                          label={`Удалить сценарий «${model.scenarios[i]}»`}
                          onClick={() =>
                            remove(`сценарий «${model.scenarios[i] || i + 1}»`, (d) => {
                              d.scenarios.splice(i, 1);
                              d.services.forEach((s) => (s.clients.splice(i, 1), s.check.splice(i, 1)));
                              d.costs.forEach((g) => g.rows.forEach((r) => r.values.splice(i, 1)));
                            })
                          }
                        />
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-1 py-2">
                  {n < MAX_SCENARIOS && (
                    <button
                      type="button"
                      aria-label="Добавить сценарий"
                      title="Добавить сценарий"
                      onClick={() =>
                        update((d) => {
                          d.scenarios.push(`Сценарий ${d.scenarios.length + 1}`);
                          d.services.forEach((s) => (s.clients.push(0), s.check.push(0)));
                          d.costs.forEach((g) => g.rows.forEach((r) => r.values.push(0)));
                        })
                      }
                      className="rounded-md p-1 text-blue-600 hover:bg-blue-50"
                    >
                      <Icon name="plus" size={16} />
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {sectionRow(
                "Количество клиентов",
                <AddButton
                  label="Направление"
                  onClick={() => update((d) => void d.services.push({ id: newId(), name: "Новое направление", clients: Array(n).fill(0), check: Array(n).fill(0) }))}
                />,
              )}
              {model.services.map((s, k) => (
                <tr key={s.id}>
                  <td className={`${stickyCell} px-1 py-0.5`}>
                    <TextInput value={s.name} label="Направление" onChange={(v) => update((d) => void (d.services[k].name = v))} />
                  </td>
                  {cols.map((i) => (
                    <td key={i} className="px-1 py-0.5">
                      <NumberInput value={s.clients[i]} label={`${s.name}: клиентов, ${model.scenarios[i]}`} onChange={(v) => update((d) => void (d.services[k].clients[i] = v))} />
                    </td>
                  ))}
                  <td className="px-1 text-center">
                    <RemoveButton label={`Удалить направление «${s.name}»`} onClick={() => remove(`направление «${s.name}»`, (d) => void d.services.splice(k, 1))} />
                  </td>
                </tr>
              ))}

              {sectionRow("Средний чек, ₽")}
              {model.services.map((s, k) => (
                <tr key={s.id}>
                  <td className={`${stickyCell} truncate px-3 py-0.5 text-slate-700`}>{s.name}</td>
                  {cols.map((i) => (
                    <td key={i} className="px-1 py-0.5">
                      <NumberInput value={s.check[i]} label={`${s.name}: средний чек, ${model.scenarios[i]}`} onChange={(v) => update((d) => void (d.services[k].check[i] = v))} />
                    </td>
                  ))}
                  <td />
                </tr>
              ))}

              {sectionRow("Выручка, ₽")}
              {model.services.map((s, k) => (
                <tr key={s.id} className="text-slate-600">
                  <td className={`${stickyCell} truncate px-3 py-1.5`}>{s.name}</td>
                  {cols.map((i) => (
                    <td key={i} className="px-3 py-1.5 text-right tabular-nums">
                      {fmt(t.revenueByService[k][i])}
                    </td>
                  ))}
                  <td />
                </tr>
              ))}
              {totalRow("Итого выручка", t.revenue)}

              {sectionRow(
                "Затраты, ₽",
                <AddButton label="Группа затрат" onClick={() => update((d) => void d.costs.push({ id: newId(), title: "Новая группа", rows: [{ id: newId(), name: "Статья", values: Array(n).fill(0) }] }))} />,
              )}
              {model.costs.map((g, k) => (
                <GroupRows
                  key={g.id}
                  group={g}
                  totals={t.groupTotals[k]}
                  cols={cols}
                  scenarios={model.scenarios}
                  onTitle={(v) => update((d) => void (d.costs[k].title = v))}
                  onRemoveGroup={() => remove(`группу «${g.title}» со всеми статьями`, (d) => void d.costs.splice(k, 1))}
                  onName={(r, v) => update((d) => void (d.costs[k].rows[r].name = v))}
                  onValue={(r, i, v) => update((d) => void (d.costs[k].rows[r].values[i] = v))}
                  onRemoveRow={(r) => remove(`статью «${g.rows[r].name}»`, (d) => void d.costs[k].rows.splice(r, 1))}
                  onAddRow={() => update((d) => void d.costs[k].rows.push({ id: newId(), name: "Новая статья", values: Array(n).fill(0) }))}
                />
              ))}
              <tr>
                <td className={`${stickyCell} px-3 py-1.5 text-slate-700`}>
                  <span className="flex items-center gap-1">
                    Налог,
                    <span className="w-14">
                      <NumberInput value={model.taxPercent} label="Налог, процент от выручки" onChange={(v) => update((d) => void (d.taxPercent = Math.min(100, v)))} />
                    </span>
                    % от выручки
                  </span>
                </td>
                {cols.map((i) => (
                  <td key={i} className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                    {fmt(t.tax[i])}
                  </td>
                ))}
                <td />
              </tr>
              {totalRow(
                "Итого затраты",
                cols.map((i) => t.costs[i] + t.tax[i]),
              )}

              {sectionRow("Итог")}
              <tr className="text-base font-semibold">
                <td className={`${stickyCell} px-3 py-2`}>Прибыль в месяц</td>
                {cols.map((i) => (
                  <td key={i} className={`px-3 py-2 text-right tabular-nums ${t.profit[i] < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                    {fmt(t.profit[i])}
                  </td>
                ))}
                <td />
              </tr>
              <tr className="text-slate-500">
                <td className={`${stickyCell} px-3 py-1`}>Рентабельность</td>
                {cols.map((i) => (
                  <td key={i} className="px-3 py-1 text-right tabular-nums">
                    {t.margin[i] === null ? "—" : `${t.margin[i]}%`}
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {dirty && (
          <div className="flex justify-end border-t border-slate-200 px-5 py-3">
            <button type="button" onClick={save} disabled={busy} className={primaryButton}>
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function GroupRows({
  group,
  totals,
  cols,
  scenarios,
  onTitle,
  onRemoveGroup,
  onName,
  onValue,
  onRemoveRow,
  onAddRow,
}: {
  group: FinModel["costs"][number];
  totals: number[];
  cols: number[];
  scenarios: string[];
  onTitle: (v: string) => void;
  onRemoveGroup: () => void;
  onName: (row: number, v: string) => void;
  onValue: (row: number, col: number, v: number) => void;
  onRemoveRow: (row: number) => void;
  onAddRow: () => void;
}) {
  return (
    <>
      <tr>
        <td className={`${stickyCell} px-1 pt-2`}>
          <TextInput value={group.title} label="Группа затрат" bold onChange={onTitle} />
        </td>
        <td colSpan={cols.length} className="pt-2" />
        <td className="px-1 pt-2 text-center">
          <RemoveButton label={`Удалить группу «${group.title}»`} onClick={onRemoveGroup} />
        </td>
      </tr>
      {group.rows.map((r, k) => (
        <tr key={r.id}>
          <td className={`${stickyCell} py-0.5 pr-1 pl-4`}>
            <TextInput value={r.name} label="Статья затрат" onChange={(v) => onName(k, v)} />
          </td>
          {cols.map((i) => (
            <td key={i} className="px-1 py-0.5">
              <NumberInput value={r.values[i]} label={`${r.name}, ${scenarios[i]}`} onChange={(v) => onValue(k, i, v)} />
            </td>
          ))}
          <td className="px-1 text-center">
            <RemoveButton label={`Удалить статью «${r.name}»`} onClick={() => onRemoveRow(k)} />
          </td>
        </tr>
      ))}
      <tr className="text-slate-600">
        <td className={`${stickyCell} py-1 pl-4`}>
          <AddButton label="Статья" onClick={onAddRow} />
        </td>
        {cols.map((i) => (
          <td key={i} className="px-3 py-1 text-right text-xs font-medium tabular-nums">
            {fmt(totals[i])}
          </td>
        ))}
        <td />
      </tr>
    </>
  );
}
