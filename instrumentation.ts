// Next.js вызывает register() при старте сервера: здесь запускаем приём сообщений из мессенджеров.
// В демо-версии мессенджеры, напоминания и рассылки не нужны
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.CHAT_POLLING !== "off" && process.env.DEMO_MODE !== "1") {
    const { startPolling } = await import("./lib/chat/poller");
    startPolling();
  }
}
