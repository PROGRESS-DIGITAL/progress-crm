import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { signOutEverywhere } from "@/app/login/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const [owner, sessions] = await Promise.all([
    db.employee.findUniqueOrThrow({ where: { id: user.id } }),
    db.session.count({ where: { employeeId: user.id, verified: true, expiresAt: { gt: new Date() } } }),
  ]);
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <h1 className="text-2xl font-semibold tracking-tight">Личные данные</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        {user.isOwner ? "Карточка владельца CRM." : `Ваша роль: ${user.roleName ?? "без роли"}.`} Имя и фото видны в шапке и на карточках сделок, где вы
        ответственный.
      </p>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
        <ProfileForm initial={owner} />
      </div>
      <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold">Пароль</h2>
          <p className="mt-1 mb-4 text-sm text-slate-600">Логин для входа: {owner.login}</p>
          <PasswordForm />
        </section>
        <section className="flex flex-col rounded-2xl border border-slate-200/60 bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold">Входы</h2>
          <p className="mt-1 mb-4 text-sm text-slate-600">
            CRM открыта на устройствах: {sessions}. Если вы вошли на чужом компьютере или потеряли телефон, выйдите везде: при следующем входе код
            спросят и на ваших устройствах.
          </p>
          <div className="mt-auto">
            <ConfirmDeleteButton
              action={signOutEverywhere}
              title="Выйти на всех устройствах?"
              message="Закроются все входы, включая этот, и CRM забудет доверенные устройства."
              label="Выйти на всех устройствах"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
