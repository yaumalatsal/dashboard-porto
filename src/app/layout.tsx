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
import "./globals.css";

export const metadata: Metadata = {
  // TODO(you): set NEXT_PUBLIC_SITE_URL to your real domain — this drives the
  // absolute URLs in the OpenGraph/Twitter share cards.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
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
  openGraph: {
    title: `${profile.name} | ${profile.role}`,
    description: profile.tagline,
    type: "website",
    locale: "en_US",
    images: ["/images/hero-field-guide.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${profile.name} | ${profile.role}`,
    description: profile.tagline,
    images: ["/images/hero-field-guide.png"],
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
      <body>{children}</body>
    </html>
  );
}
