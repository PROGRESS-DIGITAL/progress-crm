import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Icon } from "@/components/icons";
import { formatAddresses, forwardSubject, forwardText, parseAddresses, quoteText, replySubject } from "@/lib/mail/core";
import { ComposeForm, type ComposeDraft } from "./compose-form";

export const dynamic = "force-dynamic";

type Search = { reply?: string; all?: string; fwd?: string; to?: string };

export default async function NewMailPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const accounts = await db.mailAccount.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true } });
  if (!accounts.length) redirect("/integrations/mail");

  const sourceId = sp.reply ?? sp.fwd;
  const source = sourceId
    ? await db.mailMessage.findUnique({ where: { id: sourceId }, include: { attachments: { select: { id: true, name: true, size: true, cid: true } } } })
    : null;

  let draft: ComposeDraft = { accountId: accounts[0].id, to: sp.to ?? "", cc: "", subject: "", text: "", attachments: [] };
  let title = "Новое письмо";
  if (source) {
    const own = accounts.find((a) => a.id === source.accountId);
    const from = formatAddresses([{ name: source.fromName, address: source.fromEmail }]);
    // Свой адрес из «Ответить всем» убираем, чтобы не слать письмо самим себе
    const others = (header: string | null) =>
      parseAddresses(header ?? "").valid.filter((e) => e.toLowerCase() !== own?.email.toLowerCase());
    if (sp.reply) {
      title = sp.all ? "Ответ всем" : "Ответ";
      const to = source.folder === "SENT" ? others(source.to) : [source.fromEmail, ...(sp.all ? others(source.to) : [])];
      draft = {
        accountId: source.accountId,
        to: [...new Set(to)].join(", "),
        cc: sp.all ? others(source.cc).join(", ") : "",
        subject: replySubject(source.subject),
        text: quoteText(source.text, from, source.date),
        replyTo: source.id,
        attachments: [],
      };
    } else {
      title = "Пересылка";
      draft = {
        accountId: source.accountId,
        to: sp.to ?? "",
        cc: "",
        subject: forwardSubject(source.subject),
        text: forwardText({ text: source.text, from, to: source.to, subject: source.subject, date: source.date }),
        // Картинки из тела письма не пересылаем отдельными файлами
        attachments: source.attachments.filter((a) => !a.cid),
      };
    }
  }

  const back = source ? `/mail?f=${source.folder === "SENT" ? "sent" : "inbox"}&m=${source.id}` : "/mail";

  return (
    <div className="w-full px-1 py-4 sm:px-3 sm:py-5">
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="back" size={16} />
        Почта
      </Link>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="rounded-2xl bg-white p-4 shadow-card sm:p-6">
        <ComposeForm accounts={accounts} draft={draft} />
      </div>
    </div>
  );
}
