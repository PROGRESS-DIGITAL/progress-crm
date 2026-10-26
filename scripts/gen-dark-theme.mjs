// Собирает app/dark-theme.css из палитры Tailwind: node scripts/gen-dark-theme.mjs
import fs from "node:fs";
const theme = fs.readFileSync("node_modules/tailwindcss/theme.css", "utf8");
const orig = {};
for (const m of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) (orig[m[1]] ??= {})[m[2]] = m[3].trim();
const steps = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const lines = [];
// Серые: светлые фоны становятся чуть светлее карточки, тёмный текст — светлым
const gray = { 50: "#2a2a2a", 100: "#303030", 200: "#3a3a3a", 300: "#4a4a4a", 400: "#7c7c7c", 500: "#9e9e9e", 600: "#b8b8b8", 700: "#d2d2d2", 800: "#e6e6e6", 900: "#f4f4f4", 950: "#fafafa" };
for (const f of ["slate", "gray", "zinc", "neutral", "stone"]) for (const s of steps) lines.push(`  --color-${f}-${s}: ${gray[s]};`);
// Синий и индиго — фирменный зелёный
const G = "#1ed760";
const green = {
  50: `color-mix(in oklab, ${G} 10%, #212121)`, 100: `color-mix(in oklab, ${G} 18%, #212121)`, 200: `color-mix(in oklab, ${G} 32%, #212121)`,
  300: `color-mix(in oklab, ${G} 55%, #212121)`, 400: G, 500: G, 600: G, 700: "#3ee27a", 800: "#64e996", 900: "#8ff0b3", 950: "#c4f7d6",
};
for (const f of ["blue", "indigo", "sky"]) for (const s of steps) lines.push(`  --color-${f}-${s}: ${green[s]};`);
// Остальные цвета: бледные фоны — тёмные оттенки, тёмный текст — светлый
const skip = new Set(["slate", "gray", "zinc", "neutral", "stone", "blue", "indigo", "sky"]);
for (const f of Object.keys(orig)) {
  if (skip.has(f) || !orig[f]["500"]) continue;
  const o = orig[f];
  const map = {
    50: `color-mix(in oklab, ${o[500]} 14%, #212121)`, 100: `color-mix(in oklab, ${o[500]} 24%, #212121)`, 200: o[800], 300: o[700],
    400: o[400], 500: o[500], 600: o[500], 700: o[300], 800: o[200], 900: o[100], 950: o[50],
  };
  for (const s of steps) lines.push(`  --color-${f}-${s}: ${map[s]};`);
}
const css = `/* Тёмная тема: Tailwind берёт цвета из переменных, поэтому вместо dark:-классов по всему коду
   здесь переопределены сами цвета. Синий становится фирменным зелёным #1ed760, карточки — #212121.
   Файл собран скриптом scripts/gen-dark-theme.mjs из палитры Tailwind */
html.dark {
  color-scheme: dark;
  --color-white: #212121;
  --color-black: #ffffff;
  --page-bg: #171717;
${lines.join("\n")}
}
`;
fs.writeFileSync("app/dark-theme.css", css);
console.log(lines.length);
