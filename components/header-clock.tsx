"use client";

import { useEffect, useState } from "react";
import { crmTimeToday } from "@/lib/format";

const msk = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

// Часы по Москве и «Время в CRM» за сегодня. Пока это время с включения компьютера, на котором запущена CRM;
// потом будет время с входа
export function HeaderClock({ serverNow, startedAt }: { serverNow: number; startedAt: number }) {
  // Первый кадр совпадает с серверным, дальше тикает по часам браузера
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden shrink-0 flex-col items-end leading-tight xl:flex" aria-live="off">
      <p className="text-xs font-medium text-slate-700 tabular-nums" title="Московское время">
        {msk.format(now)} <span className="text-slate-400">МСК</span>
      </p>
      <p className="text-xs text-slate-500 tabular-nums" title="Сбрасывается каждый день в 00:00 по Москве">
        Время в CRM: {crmTimeToday(now, startedAt)}
      </p>
    </div>
  );
}
