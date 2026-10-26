// «fetch failed» ничего не говорит человеку: достаём настоящую причину из error.cause
export const RU_SERVICE_HINT =
  "если включён VPN, выключите его или добавьте этот адрес в исключения: российские сервисы часто не пускают зарубежные подключения";

const CERT_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

// Код из error.cause; при нескольких адресах хоста Node кладёт ошибки в AggregateError
export function errorCode(e: unknown): string | undefined {
  const cause = (e as { cause?: { code?: string; errors?: { code?: string }[] } })?.cause;
  return cause?.code ?? cause?.errors?.[0]?.code ?? (e as { code?: string })?.code;
}

export function networkError(e: unknown, host: string, hint = RU_SERVICE_HINT) {
  const code = errorCode(e);
  if (code && CERT_CODES.has(code)) return `${host}: система не доверяет сертификату сайта (${code})`;
  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return `не найден адрес ${host}: проверьте интернет`;
    case "ETIMEDOUT":
    case "UND_ERR_CONNECT_TIMEOUT":
      return `${host} не отвечает, ${hint}`;
    case "ECONNRESET":
    case "ECONNREFUSED":
    case "UND_ERR_SOCKET":
      return `соединение с ${host} сброшено, ${hint}`;
    case "UND_ERR_ABORTED":
      return "запрос прерван";
    default:
      if (e instanceof Error && e.message !== "fetch failed") return e.message;
      return `нет связи с ${host}${code ? ` (${code})` : ""}: ${hint}`;
  }
}

// fetch, который при сетевой ошибке бросает понятное сообщение; отмену по signal пропускает как есть
export async function netFetch(url: string, init?: RequestInit, hint?: string) {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (init?.signal?.aborted) throw e;
    throw new Error(networkError(e, new URL(url).host, hint));
  }
}
