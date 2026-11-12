// Типы связей, общие для сервера и форм в браузере
export type LinkKind = "DEAL" | "TASK" | "MEETING";
export type LinkTarget = { type: "deal" | "event"; id: string };
// Вторая сторона связи, как её показывает карточка
export type LinkRow = { id: string; kind: LinkKind; targetId: string; title: string; href: string };
export type LinkOption = { id: string; title: string; hint: string; href: string };
export type LinkOptions = { deals: LinkOption[]; tasks: LinkOption[]; meetings: LinkOption[] };

export const targetOf = (kind: LinkKind, id: string): LinkTarget => ({ type: kind === "DEAL" ? "deal" : "event", id });
export const targetKey = (t: LinkTarget) => `${t.type}:${t.id}`;
