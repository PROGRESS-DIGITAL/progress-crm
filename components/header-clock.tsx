"use client";

import { useEffect, useState } from "react";
import { addCrmTime, formatCrmTime, type CrmTime } from "@/lib/format";

const msk = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

function read(key: string): CrmTime | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as CrmTime | null;
    return v && typeof v.total === "number" && typeof v.last === "number" && typeof v.day === "string" ? v : null;
  } catch {
    return null;
  }
}

// Часы по Москве и «Время в CRM»: сколько сегодня CRM была открыта на экране у этого сотрудника
export function HeaderClock({ serverNow, userId }: { serverNow: number; userId: string }) {
  // Первый кадр совпадает с серверным, дальше тикает по часам браузера
  const [now, setNow] = useState(serverNow);
  const [spent, setSpent] = useState<number | null>(null);

  useEffect(() => {
    const key = `crm-time:${userId}`;
    // Без localStorage (приватный режим) время копится только в этой вкладке
    let memory: CrmTime | null = null;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (document.visibilityState !== "visible") return;
      const next = addCrmTime(read(key) ?? memory, t);
      memory = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      setSpent(next.total);
    };
    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId]);

  return (
    <div className="hidden shrink-0 flex-col items-end leading-tight xl:flex" aria-live="off">
      <p className="text-xs font-medium text-slate-700 tabular-nums" title="Московское время">
        {msk.format(now)} <span className="text-slate-400">МСК</span>
      </p>
      <p
        className="text-xs text-slate-500 tabular-nums"
        title="Сколько вы сегодня провели в CRM: время идёт, пока CRM открыта на экране. Сбрасывается в 00:00 по Москве"
      >
        Время в CRM: {spent === null ? "--:--" : formatCrmTime(spent)}
      </p>
    </div>
  );
}
