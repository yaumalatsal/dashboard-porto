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
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://aether.dev"),
  title: {
    default: "Aether Field Office | Creative Developer & IT Architect",
    template: "%s | Aether",
  },
  description:
    "An independent field office mapping expressive interfaces, resilient software, and digital infrastructure.",
  keywords: [
    "creative developer",
    "IT architect",
    "WebGL",
    "Laravel",
    "network infrastructure",
  ],
  authors: [{ name: "Aether" }],
  openGraph: {
    title: "Aether Field Office | Creative Developer & IT Architect",
    description: "Mapping digital terrain, from interface to infrastructure.",
    type: "website",
    locale: "en_US",
    images: ["/images/hero-field-guide.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aether Field Office | Creative Developer & IT Architect",
    description: "Mapping digital terrain, from interface to infrastructure.",
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
