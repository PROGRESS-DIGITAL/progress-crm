import { readFileSync, statSync } from "node:fs";
import path from "node:path";

// Серверное действие приходит POST-запросом с заголовком Next-Action: <id>. По манифесту сборки
// узнаём файл, где оно объявлено (app/finance/actions.ts), а по файлу — раздел CRM
type Manifest = { node?: Record<string, { filename?: string }> };

const CANDIDATES = [".next/server/server-reference-manifest.json", ".next/dev/server/server-reference-manifest.json"];

let cached: { file: string; mtime: number; map: Record<string, { filename?: string }> } | null = null;

function load() {
  for (const rel of CANDIDATES) {
    const file = path.join(/* turbopackIgnore: true */ process.cwd(), rel);
    try {
      const mtime = statSync(file).mtimeMs;
      if (cached?.file === file && cached.mtime === mtime) return cached.map;
      const data = JSON.parse(readFileSync(file, "utf8")) as Manifest;
      cached = { file, mtime, map: data.node ?? {} };
      return cached.map;
    } catch {}
  }
  return null;
}

// undefined — манифеста нет (такого не бывает в собранной CRM); null — действие неизвестно
export function actionFile(id: string): string | null | undefined {
  const map = load();
  if (!map) return undefined;
  return map[id]?.filename ?? null;
}
