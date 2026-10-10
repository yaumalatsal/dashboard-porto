"use client";

/**
 * The portfolio's "signal" layer: the small, systemic motion that makes the
 * page feel like an instrument readout — after kprverse.com's HUD language.
 *
 * Text gets one of two treatments, chosen by how long it is:
 *
 *   SHORT labels (the monospaced captions, tags and nav links) decode:
 *   characters type in behind a band of noise the first time they reach the
 *   screen, and links replay a pass of that noise on hover. Headings and
 *   names do not: they must stay readable from the first frame.
 *
 *   LONG text (paragraphs) flows: it rises into place a line of reading at a
 *   time. Decoding a paragraph would make it unreadable for the second or two
 *   it runs, and for anyone using a screen reader or a translator it would be
 *   noise, not an effect.
 *
 * The blinking markers and link wipes are pure CSS (observatory.css). This
 * file only does what CSS cannot: noticing when text first appears, and
 * running the decode.
 *
 * Cost is kept near zero on purpose. One IntersectionObserver per treatment
 * instead of scroll listeners, one delegated pointer listener instead of one
 * per link, all decodes sharing a single animation-frame loop, and no work at
 * all under reduced motion.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { scrambleMany, isScrambling, cancelAll } from "@/lib/scramble";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useUiStore } from "@/stores/uiStore";

type Rule = {
  select: string;
  /** Animate these descendants instead of the match itself. */
  parts?: string;
  speed?: number;
};

/**
 * Decode in once, when first seen. The first rule to claim an element wins.
 *
 * Only small monospaced labels decode. Headings, names and titles used to as
 * well, and with a dozen runs going at once the page read as corrupted text:
 * a heading in noise is a heading nobody can read. Headings keep their slide
 * (observatory.css), which is motion without making the words illegible.
 */
const ENTER: Rule[] = [
  {
    select: [
      "[data-scramble]",
      ".obs-label",
      ".obs-status",
      ".obs-hero-location",
      ".obs-hero-bottom > span",
      ".obs-hero-bottom a",
      ".obs-project-bar > span",
      ".obs-tags span",
      ".obs-archive small",
      ".site-nav__links a",
      ".site-nav__resume",
      ".site-nav__console",
      ".sign-off__end",
      ".sign-off__base > span",
    ].join(","),
  },
];

/** Replay a sweep of noise on hover. */
const HOVER: Rule[] = [
  { select: ".obs-archive > a", parts: "small" },
  { select: ".obs-project", parts: ".obs-project-bar > span" },
  {
    select: [
      "[data-scramble-hover]",
      ".site-nav__links a",
      ".site-nav__resume",
      ".site-nav__console",
      ".obs-hero-bottom a",
      ".obs-text-link",
      ".obs-button",
      ".obs-contact-email",
      ".sign-off__base a",
      ".sign-off__fleet",
    ].join(","),
  },
];

const HOVER_SELECTOR = HOVER.map((rule) => rule.select).join(",");

/** Markers that blink when their label first appears. */
const SIGNAL_TARGETS = ".obs-label";

/**
 * Persistent elements (the nav) are decoded once per visit, not once per
 * route: the effect below re-runs on every navigation.
 */
const decoded = new WeakSet<Element>();

/** Never touched: a résumé is a document, and decoding it fights printing. */
const SKIP = ".resume";

function collect(rules: Rule[]): Map<Element, number> {
  const found = new Map<Element, number>();
  for (const rule of rules) {
    for (const el of document.querySelectorAll(rule.select)) {
      if (!found.has(el) && !el.closest(SKIP)) found.set(el, rule.speed ?? 1);
    }
  }
  return found;
}

/**
 * Paragraphs that should flow in. Excludes anything already claimed by the
 * decode, hero and footer copy (visible on arrival), and text inside a closed
 * <details>, which has no position to reveal at.
 */
function collectFlow(claimed: Map<Element, number>): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of document.querySelectorAll<HTMLElement>("#main-content p")) {
    if (claimed.has(el)) continue;
    if (el.closest(`${SKIP}, .obs-hero, .sign-off, details`)) continue;
    out.push(el);
  }
  return out;
}

export default function SignalLayer() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const isLoaderComplete = useUiStore((state) => state.isLoaderComplete);

  useEffect(() => {
    // Nothing runs behind the intro overlay: text that decodes while covered
    // has spent its one appearance where nobody could see it.
    if (reducedMotion || !isLoaderComplete) return;

    // Decode works on any device. Hover replays need a pointer that hovers.
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let enter: Map<Element, number> = new Map();
    let flow: HTMLElement[] = [];
    let enterObserver: IntersectionObserver | undefined;
    let flowObserver: IntersectionObserver | undefined;

    // Queried after paint: on a client-side navigation the new page's
    // elements are not in the DOM yet when this effect first runs.
    const raf = requestAnimationFrame(() => {
      enter = collect(ENTER);
      flow = collectFlow(enter);

      // Claims an element and returns its job, or null if already decoded.
      // Jobs are run together by decodeAll, never one at a time: see below.
      const claim = (el: Element, stagger: number): [Element, { mode: "write"; speed: number; delay: number }] | null => {
        if (decoded.has(el)) return null;
        decoded.add(el);
        if (el.matches(SIGNAL_TARGETS)) el.classList.add("is-signal");
        // Things arriving together decode in a quick cascade rather than all
        // at once, which is what makes it read as a system booting.
        return [el, { mode: "write", speed: enter.get(el) ?? 1, delay: stagger }];
      };
      // One batch per frame: every element is measured before any is rewritten.
      // Started one by one, each measurement came after the previous rewrite
      // and forced a full layout — six headings entering together cost six.
      const decodeAll = (jobs: NonNullable<ReturnType<typeof claim>>[]) => {
        if (jobs.length) scrambleMany(jobs);
      };

      enterObserver = new IntersectionObserver(
        (entries) => {
          const jobs: NonNullable<ReturnType<typeof claim>>[] = [];
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            enterObserver?.unobserve(entry.target);
            const job = claim(entry.target, jobs.length * 40);
            if (job) jobs.push(job);
          }
          decodeAll(jobs);
        },
        // Fire a little after the element is in view, so the decode is seen
        // rather than finished at the bottom edge.
        { rootMargin: "0px 0px -12% 0px" },
      );

      // Whatever is already on screen when the page settles starts at once.
      // The observer's inset margin would otherwise skip the bottom strip of
      // the first screen — and the hero is pinned, so anything there (the
      // "View projects" links) would never scroll up out of that strip.
      const initial: NonNullable<ReturnType<typeof claim>>[] = [];
      for (const el of enter.keys()) {
        if (decoded.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) {
          const job = claim(el, initial.length * 40);
          if (job) initial.push(job);
        } else {
          enterObserver.observe(el);
        }
      }
      decodeAll(initial);

      // Long text: hold back only what is below the fold. Anything already on
      // screen is left alone, so there is no flash of text that vanishes and
      // returns, and with scripting off or failing nothing is ever hidden.
      flowObserver = new IntersectionObserver(
        (entries) => {
          let stagger = 0;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLElement;
            flowObserver?.unobserve(el);
            el.style.setProperty("--flow-delay", `${stagger}ms`);
            el.classList.remove("is-pending");
            stagger += 90;
          }
        },
        { rootMargin: "0px 0px -8% 0px" },
      );
      for (const el of flow) {
        if (el.getBoundingClientRect().top <= window.innerHeight) continue;
        el.classList.add("obs-flow", "is-pending");
        flowObserver.observe(el);
      }
    });

    // One delegated listener for every hover target on the page.
    let hovered: Element | null = null;
    const lastSweep = new WeakMap<Element, number>();
    const onPointerOver = (event: PointerEvent) => {
      if (!canHover) return;
      const target = (event.target as Element | null)?.closest(HOVER_SELECTOR) ?? null;
      // Compare with the element we last swept, not with relatedTarget:
      // splitting text swaps DOM nodes under a resting cursor, and the browser
      // answers by firing a fresh pointerover with no relatedTarget. Judged by
      // relatedTarget that would sweep again, and again, for as long as the
      // cursor sat still.
      if (target === hovered) return;
      hovered = target;
      if (!target || performance.now() - (lastSweep.get(target) ?? 0) < 350) return;
      lastSweep.set(target, performance.now());

      const rule = HOVER.find((r) => target.matches(r.select));
      const parts = rule?.parts ? Array.from(target.querySelectorAll(rule.parts)) : [target];
      // Together, so a card's title and category are measured before either
      // is rewritten.
      scrambleMany(
        parts.filter((part) => !isScrambling(part)).map((part): [Element, { mode: "sweep"; speed: number }] => [part, { mode: "sweep", speed: 0.55 }]),
      );
    };
    document.addEventListener("pointerover", onPointerOver, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      enterObserver?.disconnect();
      flowObserver?.disconnect();
      document.removeEventListener("pointerover", onPointerOver);
      // Put the real text back and show everything that was waiting, so a
      // change of route or of motion preference never strands hidden content.
      cancelAll();
      for (const el of flow) el.classList.remove("is-pending");
    };
  }, [pathname, reducedMotion, isLoaderComplete]);

  return null;
}
