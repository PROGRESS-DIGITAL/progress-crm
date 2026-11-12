import type { SourceIds, SourceRef } from "@/lib/source-link";

export type CalEvent = {
  id: string;
  kind: "MEETING" | "TASK";
  title: string;
  notes: string;
  start: string;
  end: string;
  allDay: boolean;
  done: boolean;
  companyId: string | null;
  companyName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  taskId: string | null;
  taskTitle: string | null;
  remindMinutes: number | null;
  // С чем связано: карточка, из которой событие создали кнопкой «Создать»
  source: SourceRef | null;
};

export type Prefill = { kind: "MEETING" | "TASK"; dealId: string; clientName: string; taskId: string } & SourceIds;

export type Options = {
  companies: { id: string; name: string }[];
  deals: { id: string; title: string; companyId: string; open: boolean }[];
  tasks: { id: string; title: string; done: boolean }[];
};
