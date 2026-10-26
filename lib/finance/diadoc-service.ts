import { db } from "@/lib/db";
import { mergeFields } from "@/lib/company-merge";
import { getSetting, setSetting } from "@/lib/settings";
import {
  draftMessage,
  DIADOC_CLIENT_SETTING,
  DIADOC_IMPORT_SETTING,
  DIADOC_ORG_SETTING,
  DIADOC_REFRESH_SETTING,
  DiadocError,
  getCounteragents,
  postDraft,
  refreshTokens,
  type CounteragentCompany,
  type DiadocClient,
  type DiadocOrg,
} from "./diadoc";
import { docTitle, getTochka } from "./documents";
import { documentPdf } from "./tochka";

let cached: { token: string; until: number } | null = null;

export function forgetDiadocToken() {
  cached = null;
}

// access-токен живёт сутки: держим в памяти, обновляем по refresh-токену и сохраняем новый refresh
export async function getDiadoc() {
  const [clientJson, refresh, orgJson] = await Promise.all([
    getSetting(DIADOC_CLIENT_SETTING),
    getSetting(DIADOC_REFRESH_SETTING),
    getSetting(DIADOC_ORG_SETTING),
  ]);
  if (!clientJson || !refresh || !orgJson) return null;
  const org = JSON.parse(orgJson) as DiadocOrg;
  if (!cached || cached.until < Date.now()) {
    const t = await refreshTokens(JSON.parse(clientJson) as DiadocClient, refresh);
    if (t.refresh_token) await setSetting(DIADOC_REFRESH_SETTING, t.refresh_token);
    cached = { token: t.access_token, until: Date.now() + (t.expires_in - 300) * 1000 };
  }
  return { token: cached.token, org };
}

// Клиент из Диадока: свои заполненные данные не трогаем, пустые поля дополняем
export async function upsertCounteragent(c: CounteragentCompany) {
  const candidates = await db.company.findMany({ where: { inn: c.inn } });
  const existing = candidates.find((x) => !c.kpp || !x.kpp || x.kpp === c.kpp);
  const incoming = { name: c.name, inn: c.inn, kpp: c.kpp, ogrn: c.ogrn, address: c.address };
  if (existing) {
    const merged = mergeFields(existing, incoming);
    const changed =
      Object.entries(merged).some(([k, v]) => (existing as Record<string, unknown>)[k] !== v) ||
      (c.boxId && existing.diadocBoxId !== c.boxId);
    if (!changed) return "same" as const;
    await db.company.update({
      where: { id: existing.id },
      data: { ...merged, diadocBoxId: c.boxId ?? existing.diadocBoxId },
    });
    return "updated" as const;
  }
  await db.company.create({ data: { ...incoming, diadocBoxId: c.boxId } });
  return "created" as const;
}

export async function importCounteragents() {
  const d = await getDiadoc();
  if (!d) throw new DiadocError("Диадок не подключён");
  const list = await getCounteragents(d.token, d.org.boxId);
  const stats = { created: 0, updated: 0, total: list.length };
  for (const c of list) {
    const r = await upsertCounteragent(c);
    if (r === "created") stats.created++;
    if (r === "updated") stats.updated++;
  }
  await setSetting(DIADOC_IMPORT_SETTING, new Date().toISOString());
  return stats;
}

export async function sendActToDiadoc(documentId: string) {
  const [d, tochka] = await Promise.all([getDiadoc(), getTochka()]);
  if (!d) throw new DiadocError("Диадок не подключён: войдите в «Интеграциях»");
  if (!tochka) throw new DiadocError("Точка не подключена: акт берётся из неё");
  const doc = await db.document.findUnique({ where: { id: documentId }, include: { company: true } });
  if (!doc || doc.kind !== "ACT" || !doc.tochkaId) throw new DiadocError("Акт не найден");

  let boxId = doc.company.diadocBoxId;
  if (!boxId && doc.company.inn) {
    const found = (await getCounteragents(d.token, d.org.boxId, doc.company.inn)).find((c) => c.inn === doc.company.inn);
    boxId = found?.boxId ?? null;
    if (boxId) await db.company.update({ where: { id: doc.companyId }, data: { diadocBoxId: boxId } });
  }
  if (!boxId) {
    throw new DiadocError("Клиента нет среди ваших контрагентов в Диадоке: пригласите его к обмену в Диадоке");
  }

  const pdf = await documentPdf(tochka.token, "closing-documents", tochka.account.customerCode, doc.tochkaId);
  const title = docTitle(doc);
  const messageId = await postDraft(
    d.token,
    draftMessage(d.org.boxId, boxId, pdf, {
      fileName: `${title}.pdf`,
      number: String(doc.seq),
      date: doc.date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" }),
      comment: `${title}: ${doc.title}`,
    }),
  );
  return db.document.update({ where: { id: doc.id }, data: { diadocMessageId: messageId, diadocAt: new Date() } });
}
