export const dynamic = "force-dynamic";

// Страницы входа: карточка по центру экрана, без меню и шапки CRM
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="logo-mark flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="5.4" strokeLinecap="square" aria-hidden>
              <path d="M8.5 5l7 7-7 7" />
            </svg>
          </span>
          <span className="text-xl leading-tight tracking-tight">
            <span className="font-bold">PROGRESS</span> <span className="font-light text-blue-600">CRM</span>
          </span>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">{children}</div>
      </div>
    </div>
  );
}
