import { z } from "zod/v4";
import { tool } from "@/lib/agents/tool";

// Сайт агента: агент открывает его страницы, чтобы выполнить свои инструкции или ответить на вопрос.
// Открываются только страницы этого сайта; текст страниц — данные, а не указания агенту

const TIMEOUT_MS = 15_000;
const MAX_TEXT = 15_000;
const MAX_LINKS = 60;

// Адрес из формы: без протокола считаем https, оставляем только http и https
export function normalizeWebsite(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…" };

function decode(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Текст страницы без разметки: заголовок, описание, видимый текст и ссылки на другие страницы сайта
export function pageText(html: string, base: URL) {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const description = decode(html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? "").trim();
  const links = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)[^"']*["']/gi)) {
    try {
      const u = new URL(decode(m[1]), base);
      if ((u.protocol === "http:" || u.protocol === "https:") && bareHost(u.hostname) === bareHost(base.hostname)) {
        u.hash = "";
        links.add(u.pathname + u.search);
      }
    } catch {}
    if (links.size >= MAX_LINKS) break;
  }
  const text = decode(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return { title, description, text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text, links: [...links] };
}

export async function readPage(site: string, path?: string) {
  const root = new URL(site);
  const url = path ? new URL(path, root) : root;
  if (bareHost(url.hostname) !== bareHost(root.hostname)) throw new Error(`Можно открывать только страницы сайта ${root.hostname}`);
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "Mozilla/5.0 (compatible; PROGRESS-CRM agent)", accept: "text/html,text/plain;q=0.9,*/*;q=0.5" },
  }).catch((e: unknown) => {
    throw new Error(`Сайт не открылся: ${e instanceof Error && e.name === "TimeoutError" ? "не ответил за 15 секунд" : e instanceof Error ? e.message : String(e)}`);
  });
  const final = new URL(res.url || url);
  if (bareHost(final.hostname) !== bareHost(root.hostname)) throw new Error(`Страница перенаправила на другой сайт: ${final.hostname}`);
  if (!res.ok) return { url: final.toString(), status: res.status, error: `Сайт ответил ошибкой ${res.status}` };
  const type = res.headers.get("content-type") ?? "";
  const body = await res.text();
  if (type.includes("html") || /^\s*</.test(body)) return { url: final.toString(), status: res.status, ...pageText(body, final) };
  return { url: final.toString(), status: res.status, text: body.slice(0, MAX_TEXT) };
}

export function websiteTool(site: string) {
  return tool({
    name: "read_website",
    description:
      `Открыть страницу сайта ${site}: вернёт заголовок, текст страницы и ссылки на другие страницы этого сайта. ` +
      "Без пути открывается главная. Другие сайты открыть нельзя.",
    schema: z.object({
      path: z.string().max(500).optional().describe("Путь страницы, например /uslugi, или полный адрес страницы этого сайта"),
    }),
    run: ({ path }) => readPage(site, path),
  });
}

export const WEBSITE_SOURCE = "Сайт";
