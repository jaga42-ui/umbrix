import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes Umbrix installable as a PWA (the base for the later
 * Android/iOS wrappers). Next serves this at /manifest.webmanifest and injects
 * the <link rel="manifest"> automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Umbrix — Jobs Indian freshers actually qualify for",
    short_name: "Umbrix",
    description:
      "A daily feed of real, scam-checked jobs and internships for Indian students and freshers — matched to your branch, batch, and skills.",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f3ec",
    theme_color: "#1c1917",
    categories: ["business", "productivity", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
