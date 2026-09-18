/**
 * Root layout — deliberately thin.
 *
 * Everything expensive (Lenis smooth scroll, the custom cursor, the WebGL
 * astrolabe, the starfield) now lives in the `(portfolio)` group's layout, so
 * the console and the API routes do not download, parse, or execute any of it.
 * Only fonts, metadata and the stylesheet are shared.
 */

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { instrumentSerif, inter, jetbrainsMono } from "@/lib/fonts";
import { profile } from "@/data/portfolio";
import PageViewBeacon from "@/components/PageViewBeacon";
import "./globals.css";

export const metadata: Metadata = {
  /**
   * Drives the absolute URLs in the OpenGraph/Twitter share cards.
   *
   * Deliberately not `NEXT_PUBLIC_` — this is only ever read on the server, and
   * a `NEXT_PUBLIC_` value is inlined into the client bundle for no reason.
   * It is supplied both as a Docker build argument and as a runtime variable:
   * fully static pages bake their metadata at build time, while the ISR
   * homepage re-reads it on revalidation.
   */
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: {
    default: `${profile.name} | ${profile.role}`,
    template: `%s | ${profile.name}`,
  },
  description: profile.bio,
  keywords: [
    "full-stack developer",
    "infrastructure engineer",
    "Next.js",
    "Docker",
    "MikroTik",
    "network infrastructure",
  ],
  authors: [{ name: profile.name }],
  /**
   * The share card is built at exactly 1200x630, the size every platform crops
   * to. The previous card was a 2.5 MB screenshot of the WebGL scene, which is
   * slow to fetch for a preview and carried no name, role or contact.
   */
  openGraph: {
    title: `${profile.name} | ${profile.role}`,
    description: profile.tagline,
    type: "website",
    locale: "en_US",
    images: ["/images/og-card.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${profile.name} | ${profile.role}`,
    description: profile.tagline,
    images: ["/images/og-card.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#05070a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <PageViewBeacon />
      </body>
    </html>
  );
}
