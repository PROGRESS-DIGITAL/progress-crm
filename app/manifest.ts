import type { MetadataRoute } from "next";

// С манифестом CRM ставится на экран «Домой» и открывается отдельным окном без строки адреса, как приложение
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PROGRESS CRM",
    short_name: "PROGRESS",
    description: "CRM агентства PROGRESS Digital",
    lang: "ru",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f1f3f8",
    theme_color: "#f1f3f8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
