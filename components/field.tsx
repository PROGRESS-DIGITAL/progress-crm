export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export const primaryButton =
  "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60";

export function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </label>
  );
}
