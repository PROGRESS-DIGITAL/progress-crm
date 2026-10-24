import Link from "next/link";
import { getOwner } from "@/lib/profile";
import { Avatar } from "@/components/avatar";

export async function HeaderProfile() {
  const owner = await getOwner();
  return (
    <Link
      href="/profile"
      title="Личные данные"
      className="ml-auto flex items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm text-slate-700 hover:bg-slate-100"
    >
      <span className="hidden sm:inline">{owner.name}</span>
      <Avatar name={owner.name} src={owner.avatar} size={32} />
    </Link>
  );
}
