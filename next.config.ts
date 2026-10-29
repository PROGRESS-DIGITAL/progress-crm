import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Шаблоны договоров из .docx, логотипы и вложения писем приходят в серверные действия целиком: лимит по умолчанию 1 МБ им мал.
  // proxy.ts по умолчанию обрезает запрос на 10 МБ, и письмо с файлами молча не уходило
  experimental: { serverActions: { bodySizeLimit: "30mb" }, proxyClientMaxBodySize: "30mb" },
};

export default nextConfig;
