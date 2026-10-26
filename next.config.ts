import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Шаблоны договоров из .docx и логотипы приходят в серверные действия целиком: лимит по умолчанию 1 МБ им мал
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default nextConfig;
