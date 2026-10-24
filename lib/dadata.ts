import { db } from "@/lib/db";

// Поиск компании по ИНН через DaData: https://dadata.ru/api/find-party/
const FIND_PARTY_URL =
  process.env.DADATA_FIND_PARTY_URL ?? "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";
export const DADATA_KEY_SETTING = "dadata.apiKey";

export type PartyInfo = {
  name: string;
  inn: string;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  director: string | null;
  phone: string | null;
  email: string | null;
  // Компания ликвидирована или в процессе: менеджеру стоит об этом знать
  inactive: boolean;
  individual: boolean;
};

type Suggestion = {
  value?: string;
  data?: {
    inn?: string;
    kpp?: string | null;
    ogrn?: string | null;
    type?: string;
    name?: { short_with_opf?: string | null; full_with_opf?: string | null; full?: string | null } | null;
    fio?: { surname?: string | null; name?: string | null; patronymic?: string | null } | null;
    management?: { name?: string | null; post?: string | null } | null;
    address?: { value?: string | null; unrestricted_value?: string | null } | null;
    state?: { status?: string | null } | null;
    phones?: { value?: string }[] | null;
    emails?: { value?: string }[] | null;
  };
};

export function partyFromSuggestion(s: Suggestion): PartyInfo | null {
  const d = s.data;
  if (!d?.inn) return null;
  const post = d.management?.post?.trim().toLowerCase();
  let director = d.management?.name ? (post ? `${d.management.name} (${post})` : d.management.name) : null;
  // У ИП нет отдельного руководителя: это сам предприниматель
  if (!director && d.type === "INDIVIDUAL") {
    const fio = [d.fio?.surname, d.fio?.name, d.fio?.patronymic].filter(Boolean).join(" ") || d.name?.full;
    if (fio) director = `${fio} (индивидуальный предприниматель)`;
  }
  return {
    name: d.name?.short_with_opf || s.value || d.name?.full_with_opf || d.inn,
    inn: d.inn,
    kpp: d.kpp || null,
    ogrn: d.ogrn || null,
    address: d.address?.value || d.address?.unrestricted_value || null,
    director,
    phone: d.phones?.[0]?.value || null,
    email: d.emails?.[0]?.value || null,
    inactive: !!d.state?.status && d.state.status !== "ACTIVE",
    individual: d.type === "INDIVIDUAL",
  };
}

export async function getDadataKey() {
  const row = await db.appSetting.findUnique({ where: { key: DADATA_KEY_SETTING } });
  return row?.value || null;
}

export async function findPartyByInn(
  inn: string,
  apiKey: string,
): Promise<{ party: PartyInfo } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(FIND_PARTY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Token ${apiKey}` },
      body: JSON.stringify({ query: inn, count: 1 }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    return { error: "DaData не отвечает. Проверьте интернет и попробуйте ещё раз." };
  }
  if (res.status === 401 || res.status === 403) return { error: "DaData не приняла ключ. Проверьте его в «Интеграциях»." };
  if (res.status === 429) return { error: "Превышен лимит запросов DaData на сегодня." };
  if (!res.ok) return { error: `DaData ответила ошибкой ${res.status}.` };
  const body = (await res.json()) as { suggestions?: Suggestion[] };
  const party = body.suggestions?.[0] ? partyFromSuggestion(body.suggestions[0]) : null;
  return party ? { party } : { error: "Компания с таким ИНН не найдена." };
}
