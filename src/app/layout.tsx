import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import Starfield from "@/components/ui/Starfield";
import ClientProviders from "@/providers/ClientProviders";
import { instrumentSerif, inter, jetbrainsMono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://aether.dev"),
  title: { default: "Aether Field Office | Creative Developer & IT Architect", template: "%s | Aether" },
  description: "An independent field office mapping expressive interfaces, resilient software, and digital infrastructure.",
  keywords: ["creative developer", "IT architect", "WebGL", "Laravel", "network infrastructure"],
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
  colorScheme: "light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#f8f2e8" },
    { media: "(prefers-color-scheme: light)", color: "#f8f2e8" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <ClientProviders>
          <Starfield />
          <Navigation />
          <main id="main-content">{children}</main>
          <Footer />
        </ClientProviders>
      </body>
    </html>
  );
}
