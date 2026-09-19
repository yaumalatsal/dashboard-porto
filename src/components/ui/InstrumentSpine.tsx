"use client";

import { useLenis } from "lenis/react";
import { useUiStore, type AstrolabeSection } from "@/stores/uiStore";

/**
 * The instrument, kept.
 *
 * The astrolabe was the identity of this site and it was on screen for one
 * viewport, then hidden for the remaining ninety per cent of the scroll. In
 * its place every section carried a numbered label — 01 through 07, tidy,
 * sequential and identical — which is the part that read as generated.
 *
 * This replaces both. One instrument stays docked for the whole page and its
 * bearing is the position: the needle swings to whichever section you are in,
 * and the ring is the page. Nothing needs to announce its own number when the
 * instrument is already pointing at it.
 *
 * Deliberately not the WebGL scene. That one carries the drag and focus logic
 * and costs a canvas; this is the same vocabulary — ring, ticks, needle — in
 * about a kilobyte of SVG, so it can afford to be present the whole way down.
 */

type Station = {
  id: AstrolabeSection;
  label: string;
  /** Degrees clockwise from north. Spread so the needle travels visibly. */
  bearing: number;
};

const STATIONS: Station[] = [
  { id: "about", label: "Practice", bearing: -128 },
  { id: "work", label: "Projects", bearing: -84 },
  { id: "skills", label: "Skills", bearing: -40 },
  { id: "operations", label: "Live systems", bearing: 4 },
  { id: "experience", label: "Experience", bearing: 48 },
  { id: "credentials", label: "Education", bearing: 92 },
  { id: "contact", label: "Contact", bearing: 136 },
];

export default function InstrumentSpine() {
  const activeSection = useUiStore((state) => state.activeSection);
  const isLoaderComplete = useUiStore((state) => state.isLoaderComplete);
  const lenis = useLenis();

  const index = STATIONS.findIndex((s) => s.id === activeSection);
  const active = index >= 0 ? STATIONS[index] : null;

  // In the hero the full instrument is already on screen behind the portrait,
  // so the docked one stays out of the way until the page starts moving.
  const docked = activeSection !== "hero" && isLoaderComplete;

  const go = (station: Station) => {
    const target = document.getElementById(station.id);
    if (!target) return;
    if (lenis) {
      lenis.start();
      lenis.scrollTo(target, { offset: -72 });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <aside
      className={`spine${docked ? " spine--docked" : ""}`}
      aria-label="Page position"
    >
      <div className="spine__dial" aria-hidden="true">
        <span className="spine__ring" />
        {STATIONS.map((station) => (
          <i
            key={station.id}
            className={`spine__tick${station.id === activeSection ? " is-active" : ""}`}
            style={{ transform: `rotate(${station.bearing}deg)` }}
          />
        ))}
        <span
          className="spine__needle"
          style={{ transform: `rotate(${(active?.bearing ?? -128) - 90}deg)` }}
        />
        <span className="spine__hub" />
      </div>

      {/* The reading, in words. The dial alone is decoration; the pair is an
          instrument. */}
      <p className="spine__reading">
        <span className="spine__index">
          {index >= 0 ? String(index + 1).padStart(2, "0") : "--"}
          <i>/{String(STATIONS.length).padStart(2, "0")}</i>
        </span>
        <strong>{active?.label ?? "Start"}</strong>
      </p>

      <ol className="spine__stations">
        {STATIONS.map((station) => (
          <li key={station.id}>
            <button
              type="button"
              className={station.id === activeSection ? "is-active" : undefined}
              aria-current={station.id === activeSection ? "true" : undefined}
              onClick={() => go(station)}
              data-cursor="link"
            >
              <span className="spine__station-mark" aria-hidden="true" />
              <span className="spine__station-name">{station.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
