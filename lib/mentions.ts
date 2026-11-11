// Упоминания коллег в комментариях: @логин. Логин — латиница, цифры, точка, дефис и подчёркивание (как при заведении сотрудника)
export type MentionPerson = { id: string; name: string; login: string; avatar: string | null };

// Перед @ не буква и не цифра, иначе это почта (ivan@progrs.ru)
const MENTION = /(^|[^\w@.])@([a-z0-9_][a-z0-9._-]*)/gi;

// Точка или дефис в конце — конец предложения, а не часть логина
const trimLogin = (s: string) => s.replace(/[.-]+$/, "");

// Логины, упомянутые в тексте: только те, что есть среди сотрудников, без повторов
export function mentionedLogins(text: string, logins: Iterable<string>) {
  const known = new Set([...logins].map((l) => l.toLowerCase()));
  const found = new Set<string>();
  for (const m of text.matchAll(MENTION)) {
    const login = trimLogin(m[2]).toLowerCase();
    if (known.has(login)) found.add(login);
  }
  return [...found];
}

// Кусок текста без ссылок делится на обычный текст и упоминания известных логинов
export function splitMentions(text: string, logins: Iterable<string>) {
  const known = new Set([...logins].map((l) => l.toLowerCase()));
  const parts: { text: string; login?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const login = trimLogin(m[2]);
    if (!known.has(login.toLowerCase())) continue;
    const at = m.index + m[1].length;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ text: `@${login}`, login: login.toLowerCase() });
    last = at + 1 + login.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// Что набирают сразу перед курсором: «@sel» или «@Илья» → искать по логину и имени. null — подсказку не показываем
export function mentionQuery(beforeCaret: string) {
  const m = beforeCaret.match(/(?:^|\s)@([\p{L}\d._-]*)$/u);
  return m ? m[1] : null;
}

// Кого подсказать по набранному: совпадение начала логина или имени/фамилии, свой логин тоже в списке
export function suggestPeople<T extends { name: string; login: string }>(people: T[], query: string, limit = 6) {
  const q = query.toLowerCase();
  if (!q) return people.slice(0, limit);
  const score = (p: T) => {
    const login = p.login.toLowerCase();
    if (login.startsWith(q)) return 0;
    if (p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q))) return 1;
    if (login.includes(q)) return 2;
    return 3;
  };
  return people
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s < 3)
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map((x) => x.p);
}
