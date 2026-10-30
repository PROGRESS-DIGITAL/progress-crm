import { db } from "@/lib/db";
import { requireOwner, deviceLabel } from "@/lib/auth/session";
import { SECTIONS } from "@/lib/auth/sections";
import { Avatar } from "@/components/avatar";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { deleteEmployee, deleteRole, setEmployeeBlocked } from "./actions";
import { AddEmployeeForm, EmployeeTools, RoleForm, RoleSelect } from "./forms";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

// Сотрудники и их доступ: кто может войти, какая роль и какие разделы ей открыты, журнал входов
export default async function EmployeesPage() {
  await requireOwner();
  const now = new Date();
  const [employees, roles, events, lastLogins] = await Promise.all([
    db.employee.findMany({ include: { role: true }, orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }] }),
    db.role.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { createdAt: "asc" } }),
    db.loginEvent.findMany({ include: { employee: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.loginEvent.groupBy({ by: ["employeeId"], where: { ok: true }, _max: { createdAt: true } }),
  ]);
  const lastLogin = new Map(lastLogins.map((l) => [l.employeeId, l._max.createdAt]));
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <h1 className="text-2xl font-semibold tracking-tight">Сотрудники</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Кто входит в CRM и что видит. Директор видит всё; сотруднику открыты только разделы его роли, остальные закрыты и по прямой ссылке.
      </p>

      <section className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Кто входит в CRM</h2>
        <ul className="flex flex-col divide-y divide-slate-100">
          {employees.map((e) => {
            const locked = e.lockedUntil && e.lockedUntil > now;
            const last = lastLogin.get(e.id);
            return (
              <li key={e.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={e.name} src={e.avatar} size={40} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {e.name}
                      {e.blocked && <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">заблокирован</span>}
                      {locked && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">вход закрыт на 15 минут</span>}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {[e.position, e.login ? `логин ${e.login}` : "логин не задан"].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {e.totpEnabled ? "Код из приложения подключён" : "Код из приложения ещё не подключён"}
                      {" · "}
                      {last ? `последний вход ${when.format(last)}` : "ещё не входил"}
                    </p>
                  </div>
                </div>
                {e.isOwner ? (
                  <p className="text-sm font-medium text-slate-700 lg:w-56">Директор · все разделы</p>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
                    <RoleSelect id={e.id} roleId={e.roleId} roles={roleOptions} />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <EmployeeTools id={e.id} name={e.name} />
                      <form action={setEmployeeBlocked.bind(null, e.id, !e.blocked)}>
                        <button type="submit" className="text-sm text-slate-600 hover:text-slate-900">
                          {e.blocked ? "Разблокировать" : "Заблокировать"}
                        </button>
                      </form>
                      <ConfirmDeleteButton
                        action={deleteEmployee.bind(null, e.id)}
                        what={`сотрудника «${e.name}»`}
                        message="Он больше не сможет войти. Сделки и задачи останутся в CRM."
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="mb-3 font-medium">Добавить сотрудника</h3>
          <AddEmployeeForm roles={roleOptions} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card sm:mt-5 sm:p-6">
        <h2 className="text-lg font-semibold">Роли и разделы</h2>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          Отметьте, какие разделы открыты роли. Изменения действуют сразу, даже у тех, кто уже вошёл. AI агент отвечает сотруднику только по его
          разделам.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="flex flex-col rounded-2xl border border-slate-200 p-4">
              <RoleForm role={{ id: r.id, name: r.name, sections: r.sections }} sections={[...SECTIONS]} />
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
                <span>Сотрудников: {r._count.employees}</span>
                <ConfirmDeleteButton
                  action={deleteRole.bind(null, r.id)}
                  what={`роль «${r.name}»`}
                  message={r._count.employees ? "У сотрудников с этой ролью закроются все разделы, пока вы не выдадите им другую." : undefined}
                  label="Удалить роль"
                />
              </div>
            </div>
          ))}
          <div className="flex flex-col rounded-2xl border border-dashed border-slate-300 p-4">
            <RoleForm role={null} sections={[...SECTIONS]} />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card sm:mt-5 sm:p-6">
        <h2 className="text-lg font-semibold">Журнал входов</h2>
        <p className="mt-1 mb-4 text-sm text-slate-600">Последние 50 попыток. О входе с нового устройства и о подборе пароля директору приходит сообщение в Telegram.</p>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">Входов ещё не было.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {events.map((ev) => (
              <li key={ev.id} className="grid gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[8.5rem_1fr_1.4fr_1fr]">
                <span className="text-slate-500 tabular-nums">{when.format(ev.createdAt)}</span>
                <span className="font-medium text-slate-800">{ev.employee?.name ?? ev.login}</span>
                <span className={ev.ok ? "text-emerald-700" : "text-rose-700"}>
                  {ev.ok ? "✓ " : "✕ "}
                  {ev.reason}
                </span>
                <span className="text-slate-500">
                  {deviceLabel(ev.userAgent)}
                  {ev.ip && `, ${ev.ip}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
