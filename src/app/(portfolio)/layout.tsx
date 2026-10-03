/**
 * The portfolio shell. Everything WebGL- or scroll-choreography-related is
 * scoped here, which is what keeps `/console` free of three.js, GSAP and Lenis.
 */

import type { ReactNode } from "react";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import "./observatory.css";
import ClientProviders from "@/providers/ClientProviders";

export default function PortfolioLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="portfolio-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <ClientProviders>
        <Navigation />
        <main id="main-content">{children}</main>
        <Footer />
      </ClientProviders>
    </div>
  );
}
