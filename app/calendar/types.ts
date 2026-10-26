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
};

export type Prefill = { kind: "MEETING" | "TASK"; dealId: string; clientName: string };

export type Options = {
  companies: { id: string; name: string }[];
  deals: { id: string; title: string; companyId: string; open: boolean }[];
  tasks: { id: string; title: string; done: boolean }[];
};
