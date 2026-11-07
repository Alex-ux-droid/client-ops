import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Client Ops",
    short_name: "Client Ops",
    description: "Центр управління клієнтами",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f7",
    theme_color: "#f4f5f7",
    lang: "uk",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Задачі на сьогодні", url: "/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
