import { DEFAULT_REMIND, addDays, dayKey, minutesOfDay, timeLabel } from "@/lib/calendar";
import type { EventInput } from "./actions";
import type { CalEvent } from "./types";

// Черновики формы события: общие для окна в календаре и карточки задачи
export function draftFromEvent(e: CalEvent): EventInput {
  const start = new Date(e.start);
  const end = new Date(e.end);
  return {
    kind: e.kind,
    title: e.title,
    notes: e.notes,
    date: dayKey(start),
    // У события на весь день end — полночь после последнего дня
    endDate: e.allDay ? addDays(dayKey(end), -1) : dayKey(end),
    startTime: timeLabel(minutesOfDay(start)),
    endTime: timeLabel(minutesOfDay(end)),
    allDay: e.allDay,
    done: e.done,
    clientName: e.companyName ?? "",
    dealId: e.dealId ?? "",
    newDealTitle: "",
    taskId: e.taskId ?? "",
    remindMinutes: e.remindMinutes === null ? "" : String(e.remindMinutes),
  };
}

export function emptyDraft(date: string, startMin: number, extra: Partial<EventInput> = {}): EventInput {
  const endMin = Math.min(startMin + 60, 23 * 60 + 59);
  return {
    kind: "TASK",
    title: "",
    notes: "",
    date,
    endDate: date,
    startTime: timeLabel(startMin),
    endTime: timeLabel(endMin),
    allDay: false,
    done: false,
    clientName: "",
    dealId: "",
    newDealTitle: "",
    taskId: "",
    remindMinutes: String(DEFAULT_REMIND),
    ...extra,
  };
}
