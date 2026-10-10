"use client";

/**
 * The sign-off.
 *
 * Replaces a footer that was the generic three-column kind — name, a row of
 * icons, a copyright line — with something that could only be this site's:
 *
 *   - a telemetry rule: real local time in Malang, its coordinates, and the
 *     live state of the services this site's own console monitors. For
 *     someone who builds and runs systems, that line is evidence, not chrome.
 *   - the name at full width, sliding in on scroll — kprverse.com closes on a
 *     wordmark the width of the page, and this is that idea in this palette.
 *     The slide is a CSS scroll timeline (observatory.css), so this file
 *     ships no animation library.
 *
 * The status is fetched once, only when the sign-off comes near the screen,
 * and the clock only ticks while it is visible: until a visitor reaches the
 * bottom of a page this component costs nothing.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { profile, socialLinks } from "@/data/portfolio";

/** Malang, to the precision a postcard would give. */
const COORDINATES = "7.97°S 112.63°E";

type Fleet = { total: number; up: number } | null;

function localTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const [time, setTime] = useState<string | null>(null);
  const [fleet, setFleet] = useState<Fleet>(null);
  const [isNear, setIsNear] = useState(false);

  // Wake only when the sign-off is about to be seen.
  useEffect(() => {
    const node = footerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNear(entry.isIntersecting),
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Minute precision is all a clock in a footer needs, so it ticks twice a
  // minute rather than every second — and not at all while out of view.
  useEffect(() => {
    if (!isNear) return;
    const tick = () => setTime(localTime());
    // The first reading goes through a callback like every later one, so the
    // effect itself never sets state while it runs.
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [isNear]);

  // Once per page view. A failed request just leaves the status out — the
  // sign-off must never show a number it could not read.
  useEffect(() => {
    if (!isNear || fleet) return;
    const controller = new AbortController();
    fetch("/api/monitor/status", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { sites?: { health?: string; hidden?: boolean }[] } | null) => {
        // Only sites with a check count. Just after a start every site reads
        // "unknown", and "0 of 3 services up" would claim an outage.
        const sites = (data?.sites ?? []).filter((site) => !site.hidden && site.health && site.health !== "unknown");
        if (sites.length) setFleet({ total: sites.length, up: sites.filter((site) => site.health === "operational").length });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isNear, fleet]);

  const fleetLabel = fleet
    ? fleet.up === fleet.total
      ? `${fleet.total} services operational`
      : `${fleet.up} of ${fleet.total} services up`
    : null;
  const fleetTone = fleet ? (fleet.up === fleet.total ? "ok" : fleet.up === 0 ? "down" : "warn") : "";

  return (
    <footer ref={footerRef} className="sign-off">
      <div className="sign-off__telemetry">
        <span className="sign-off__end">End of transmission</span>
        <span>
          {time ? <>Malang <b>{time}</b> WIB</> : "Malang"} · {COORDINATES}
        </span>
        {fleetLabel && (
          <Link href="/console" className={`sign-off__fleet sign-off__fleet--${fleetTone}`}>
            {fleetLabel} ↗
          </Link>
        )}
      </div>

      {/* Decorative: the name is also given as text in the line below. */}
      <div className="sign-off__stage" aria-hidden="true">
        <p className="sign-off__mark">{profile.shortName}</p>
      </div>

      <div className="sign-off__base">
        <span>© {new Date().getFullYear()} {profile.name}</span>
        <nav aria-label="Elsewhere">
          {profile.email && <a href={`mailto:${profile.email}`}>Email</a>}
          {socialLinks.map((social) => (
            <a key={social.label} href={social.href} target="_blank" rel="noreferrer">{social.label}</a>
          ))}
          <Link href="/resume">Résumé</Link>
          <a href="#main-content" className="sign-off__top"><ArrowUp size={14} aria-hidden="true" /> Top</a>
        </nav>
      </div>
    </footer>
  );
}
