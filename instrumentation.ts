// Next.js вызывает register() при старте сервера: здесь запускаем приём сообщений из мессенджеров
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.CHAT_POLLING !== "off") {
    const { startPolling } = await import("./lib/chat/poller");
    startPolling();
  }
}
