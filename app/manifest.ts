import type { MetadataRoute } from "next"

// Web app manifest, served at /manifest.webmanifest. Makes Flyt installable ("Add to home screen").
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/rider",
    name: "Flyt",
    short_name: "Flyt",
    description: "Book a car with a licensed driver in Kigali.",
    start_url: "/rider",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8faf6",
    theme_color: "#008e53",
    lang: "en",
    categories: ["travel", "navigation"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Book a ride", url: "/rider", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Driver app", url: "/driver", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
