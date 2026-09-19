import type { MetadataRoute } from "next";
import { profile } from "@/data/portfolio";

/**
 * The installed-app identity.
 *
 * It described an "Aether Field Office" that no longer exists anywhere on the
 * site, and set both colours to #f8f2e8 — cream, against a page whose root is
 * #0e0818. Anything that reads theme_color (the Android task switcher, the
 * address bar, the splash screen behind a launching PWA) was painting this
 * site white before a single pixel of it rendered.
 *
 * The name comes from the profile so it cannot drift from the page again.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${profile.name} — ${profile.role}`,
    short_name: profile.shortName,
    description: profile.tagline,
    start_url: "/",
    display: "standalone",
    // Matches `html { background: #0e0818 }`, so the splash and the page agree.
    background_color: "#0e0818",
    theme_color: "#0e0818",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Cropped to a circle on Android, so the mark sits inside the safe zone.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
