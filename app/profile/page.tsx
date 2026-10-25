import { getOwner } from "@/lib/profile";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const owner = await getOwner();
  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <h1 className="text-2xl font-semibold tracking-tight">Личные данные</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Карточка владельца CRM. Имя и фото видны в шапке и на карточках сделок, где вы ответственный.
      </p>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card p-6">
        <ProfileForm initial={owner} />
      </div>
    </div>
  );
}
