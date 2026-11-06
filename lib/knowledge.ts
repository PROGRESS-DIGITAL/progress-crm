import type { KnowledgeKind } from "@prisma/client";

// Разделы базы знаний: во множественном числе — для фильтра, в единственном — для метки материала
export const KNOWLEDGE_KINDS: { kind: KnowledgeKind; plural: string; one: string }[] = [
  { kind: "BRIEF", plural: "Брифы", one: "Бриф" },
  { kind: "CONTRACT", plural: "Договоры", one: "Договор" },
  { kind: "PROPOSAL", plural: "КП", one: "КП" },
  { kind: "SPEC", plural: "ТЗ", one: "ТЗ" },
  { kind: "STANDARD", plural: "Стандарты работы", one: "Стандарт работы" },
  { kind: "SCRIPT", plural: "Скрипты", one: "Скрипт" },
  { kind: "OTHER", plural: "Другое", one: "Другое" },
];

export function isKnowledgeKind(v: unknown): v is KnowledgeKind {
  return KNOWLEDGE_KINDS.some((k) => k.kind === v);
}

export function knowledgeLabel(kind: unknown) {
  return KNOWLEDGE_KINDS.find((k) => k.kind === kind)?.one ?? "Материал";
}
