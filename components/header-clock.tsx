"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

const msk = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

// Часы по Москве и «Время в CRM». Пока это время работы компьютера, на котором запущена CRM; потом будет время с входа
export function HeaderClock({ serverNow, uptime }: { serverNow: number; uptime: number }) {
  // Первый кадр совпадает с серверным, дальше тикает по часам браузера
  const [now, setNow] = useState(serverNow);
  const [startedAt] = useState(() => (typeof performance === "undefined" ? 0 : performance.now()));
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      setElapsed((performance.now() - startedAt) / 1000);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div className="hidden shrink-0 flex-col items-end leading-tight xl:flex" aria-live="off">
      <p className="text-xs font-medium text-slate-700 tabular-nums" title="Московское время">
        {msk.format(now)} <span className="text-slate-400">МСК</span>
      </p>
      <p className="text-xs text-slate-500 tabular-nums">Время в CRM: {formatDuration(uptime + elapsed)}</p>
    </div>
  );
}
