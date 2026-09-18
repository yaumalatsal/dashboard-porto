/**
 * Console shell.
 *
 * A server component with no providers: no Lenis, no GSAP, no WebGL, no custom
 * cursor. The only client JavaScript on these pages is the handful of small
 * interactive pieces (range picker, chart tooltips, auto-refresh).
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import ConsoleNav from "@/components/console/ConsoleNav";
import { profile } from "@/data/portfolio";
import "./console.css";

export const metadata: Metadata = {
  title: "Console",
  description: "The status of the applications that I run in production.",
};

export default function ConsoleLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="console">
      <header className="console__bar">
        <Link href="/console" className="console__brand">
          <span className="console__sigil" aria-hidden="true" />
          <span className="console__brand-text">
            {profile.shortName} <small>Console</small>
          </span>
        </Link>
        <ConsoleNav />
        <Link href="/" className="console__back">
          ← Portfolio
        </Link>
      </header>
      <main className="console__main">{children}</main>

      {/* Closes the loop back to the portfolio, mirroring the "Console ↗"
          entry in the site header. */}
      <footer className="console__footer">
        <span>
          {profile.name} — {profile.role}
        </span>
        <Link href="/">Back to the portfolio ←</Link>
      </footer>
    </div>
  );
}
