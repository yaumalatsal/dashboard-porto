"use client";

/**
 * The portfolio's "signal" layer: the small, systemic motion that makes the
 * page feel like an instrument readout — after kprverse.com's HUD language.
 *
 *   - labels decode in (scrambled text) the first time they reach the screen
 *   - their square markers blink, like a status LED coming online
 *   - monospaced links run a band of noise across themselves on hover
 *
 * The blinking and the link wipes are pure CSS (observatory.css). This file
 * only does what CSS cannot: noticing when a label first appears, and running
 * the text decode.
 *
 * Cost is kept near zero on purpose. One IntersectionObserver instead of
 * scroll listeners, one delegated pointer listener instead of one per link,
 * no work at all under reduced motion, and the decode only on fine-pointer
 * devices — on a phone it would cost battery for an effect that needs a
 * cursor to be noticed, and screen readers are most common there too.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { scramble, isScrambling } from "@/lib/scramble";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useUiStore } from "@/stores/uiStore";

/** Decode in once, when first seen. */
const ENTER_TARGETS = [
  "[data-scramble]",
  ".obs-section > .obs-label",
  ".obs-hero-copy > .obs-label",
  ".obs-hero-location",
  ".obs-project-bar > span",
  ".obs-project-title .obs-label",
  ".obs-tags span",
  ".obs-archive > .obs-label",
  ".obs-archive small",
  ".obs-hero-bottom > span",
].join(",");

/** Replay a sweep on hover. */
const HOVER_TARGETS = [
  "[data-scramble-hover]",
  ".site-nav__links a",
  ".site-nav__resume",
  ".obs-hero-bottom a",
  ".obs-archive a",
].join(",");

/** Markers that blink when their label first appears. */
const SIGNAL_TARGETS = ".obs-label";

/**
 * Only monospaced text keeps its width while scrambled. A proportional face
 * would reflow on every frame, so the check is made on the computed font, not
 * trusted to the selector lists above.
 */
function isMonospaced(el: Element): boolean {
  const family = getComputedStyle(el).fontFamily.toLowerCase();
  return family.includes("mono") || family.includes("consolas");
}

export default function SignalLayer() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const isLoaderComplete = useUiStore((state) => state.isLoaderComplete);

  useEffect(() => {
    // Nothing runs behind the intro overlay: a label that decodes while
    // covered has spent its one appearance where nobody could see it.
    if (reducedMotion || !isLoaderComplete) return;

    const canDecode = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const seen = new WeakSet<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        let stagger = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          observer.unobserve(el);
          if (seen.has(el)) continue;
          seen.add(el);

          if (el.matches(SIGNAL_TARGETS)) el.classList.add("is-signal");
          if (canDecode && el.matches(ENTER_TARGETS) && isMonospaced(el)) {
            // Labels arriving together decode in a quick cascade rather than
            // all at once, which is what makes it read as a system booting.
            scramble(el, { mode: "write", delay: stagger });
            stagger += 70;
          }
        }
      },
      // Fire a little after the element is in view, so the decode is seen
      // rather than finished at the bottom edge.
      { rootMargin: "0px 0px -12% 0px" },
    );

    // Queried after paint: on a client-side navigation the new page's
    // elements are not in the DOM yet when this effect first runs.
    const raf = requestAnimationFrame(() => {
      document
        .querySelectorAll(`${ENTER_TARGETS},${SIGNAL_TARGETS}`)
        .forEach((el) => observer.observe(el));
    });

    // One delegated listener for every hover target on the page.
    const onPointerOver = (event: PointerEvent) => {
      if (!canDecode) return;
      const target = (event.target as Element | null)?.closest(HOVER_TARGETS);
      if (!target) return;
      // pointerover bubbles from every child; only react on entering the link
      // itself, not on moving between its icon and its text.
      const from = event.relatedTarget as Node | null;
      if (from && target.contains(from)) return;
      // A row set in a proportional face (an archive entry) sweeps only its
      // monospaced parts — the category — and leaves the title still.
      const parts = isMonospaced(target)
        ? [target]
        : Array.from(target.querySelectorAll("small, .obs-label")).filter(isMonospaced);
      for (const part of parts) {
        if (!isScrambling(part)) scramble(part, { mode: "sweep", speed: 0.55 });
      }
    };
    document.addEventListener("pointerover", onPointerOver, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("pointerover", onPointerOver);
    };
  }, [pathname, reducedMotion, isLoaderComplete]);

  return null;
}
