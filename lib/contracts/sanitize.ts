// Договор и шаблон хранятся как HTML из редактора или из .docx.
// Убираем всё исполняемое: скрипты, встраиваемые объекты, обработчики on* и ссылки javascript:
export function sanitizeHtml(html: string) {
  return html
    .replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|noscript|template)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|xlink:href)\s*=\s*("\s*(javascript|vbscript|data:(?!image\/))[^"]*"|'\s*(javascript|vbscript|data:(?!image\/))[^']*'|(javascript|vbscript):[^\s>]*)/gi, "")
    .replace(/\s+contenteditable\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}
