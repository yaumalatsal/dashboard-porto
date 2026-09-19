"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useUiStore } from "@/stores/uiStore";
import { profile } from "@/data/portfolio";
import type { HeroReadout } from "@/lib/monitor/hero";

/** Marks around the reticle that frames the face. Every third is drawn long. */
const RETICLE_TICKS = Array.from({ length: 48 }, (_, i) => i);

export default function HeroSection({ readout }: { readout: HeroReadout | null }) {
  const shellRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const isLoaderComplete = useUiStore((state) => state.isLoaderComplete);

  useGSAP(
    () => {
      if (!shellRef.current || prefersReducedMotion) {
        return;
      }

      if (isLoaderComplete) {
        gsap.fromTo(
          "[data-hero-line]",
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 1, stagger: 0.09, ease: "power3.out" },
        );
        gsap.fromTo("[data-hero-detail]", { opacity: 0 }, { opacity: 1, duration: 0.9, stagger: 0.08, delay: 0.35 });
        // Resolves out of the dark after the name lands.
        gsap.fromTo(
          "[data-hero-portrait]",
          { opacity: 0, scale: 1.04 },
          { opacity: 1, scale: 1, duration: 1.6, delay: 0.5, ease: "power2.out" },
        );
        // The frame draws itself around the face, so the reticle reads as an
        // instrument acquiring a subject rather than a border that was always
        // there.
        gsap.fromTo(
          "[data-hero-reticle]",
          { opacity: 0, scale: 1.14, rotate: -14 },
          { opacity: 1, scale: 1, rotate: 0, duration: 1.8, delay: 0.7, ease: "power3.out" },
        );
        gsap.fromTo(
          "[data-hero-tick]",
          { opacity: 0 },
          { opacity: 1, duration: 0.5, stagger: 0.008, delay: 0.9, ease: "none" },
        );
        gsap.fromTo(
          "[data-hero-stat]",
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.09, delay: 1.1, ease: "power3.out" },
        );
      }

      // The reticle keeps turning for as long as the hero is on screen. A
      // frame that stops turning is a decoration; one that does not is a
      // reading being taken.
      const idle = [
        gsap.to("[data-hero-reticle-outer]", {
          rotate: "+=360",
          duration: 140,
          ease: "none",
          repeat: -1,
        }),
        gsap.to("[data-hero-reticle-inner]", {
          rotate: "-=360",
          duration: 88,
          ease: "none",
          repeat: -1,
        }),
        gsap.to("[data-hero-reticle-scan]", {
          rotate: "+=360",
          duration: 9,
          ease: "none",
          repeat: -1,
        }),
      ];

      const media = gsap.matchMedia();
      media.add("(min-width: 768px)", () => {
        gsap.timeline({
          scrollTrigger: {
            trigger: shellRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.75,
          },
        })
          .to("[data-hero-detail]", { opacity: 0, y: -14, ease: "none" }, 0)
          .to(".hero-title", { x: "12vw", y: "12vh", scale: 1.45, transformOrigin: "left center", ease: "none" }, 0)
          .to(
            ".hero-title > span",
            { color: "rgba(244, 229, 194, 0)", WebkitTextStroke: "1px rgba(221, 174, 92, 0.72)", ease: "none" },
            0.28,
          )
          .to(".hero-copy__statement", { x: "8vw", opacity: 0.12, ease: "none" }, 0.18)
          .fromTo("[data-hero-divider]", { scaleY: 0 }, { scaleY: 1, ease: "none" }, 0.08)
          .to("[data-hero-divider]", { x: () => window.innerWidth * 0.42, ease: "none" }, 0.36)
          .to(".hero-title", { opacity: 0.12, scale: 1.72, ease: "none" }, 0.78)
          // The readout leaves first and fastest: it is the layer nearest the
          // reader, so it should clear before the portrait behind it.
          .to("[data-hero-readout]", { yPercent: 40, opacity: 0, ease: "none" }, 0)
          // Slower than the copy, so the hero has depth rather than one
          // flat plane sliding away.
          .to("[data-hero-portrait]", { yPercent: -12, scale: 1.06, opacity: 0, ease: "none" }, 0.1)
          .to("[data-hero-reticle]", { yPercent: -18, scale: 1.18, opacity: 0, ease: "none" }, 0.05);
      });

      media.add("(max-width: 767px)", () => {
        gsap.timeline({
          scrollTrigger: { trigger: shellRef.current, start: "top top", end: "bottom bottom", scrub: 0.75 },
        })
          .to("[data-hero-detail]", { yPercent: -45, opacity: 0, stagger: 0.1, ease: "power2.in" }, 0)
          .to("[data-hero-line]", { yPercent: -65, opacity: 0, stagger: 0.12, ease: "power2.in" }, 0)
          .to("[data-hero-divider]", { scaleY: 0, opacity: 0, ease: "power2.in" }, 0)
          .to("[data-hero-instrument]", { opacity: 0, yPercent: -5, scale: 0.95, ease: "power2.in" }, 0.1)
          .to("[data-hero-readout]", { opacity: 0, yPercent: 30, ease: "power2.in" }, 0)
          .to("[data-hero-portrait]", { opacity: 0, yPercent: -8, ease: "power2.in" }, 0)
          .to("[data-hero-reticle]", { opacity: 0, yPercent: -8, ease: "power2.in" }, 0);
      });

      return () => {
        media.revert();
        idle.forEach((tween) => tween.kill());
      };
    },
    { scope: shellRef, dependencies: [isLoaderComplete, prefersReducedMotion] },
  );

  return (
    <section ref={shellRef} id="hero" className="hero-shell" aria-labelledby="hero-title">
      <div className="hero-stage">
        <div className="hero-transition-line" data-hero-divider aria-hidden="true" />

        {/* Corner brackets. They give the stage an edge, so the copy on the
            left and the portrait on the right sit inside one plate instead of
            drifting on open black. */}
        <div className="hero-frame" aria-hidden="true">
          <span className="hero-frame__corner hero-frame__corner--tl" />
          <span className="hero-frame__corner hero-frame__corner--tr" />
          <span className="hero-frame__corner hero-frame__corner--bl" />
          <span className="hero-frame__corner hero-frame__corner--br" />
        </div>

        <div className="hero-copy" data-hero-copy>
          {/* The eyebrow carries the role, not a mood: it is the first line a
              recruiter reads and it should answer "what is this person". */}
          <p className="hero-copy__eyebrow" data-hero-detail>{profile.role} <span>/</span> {profile.location}</p>
          <h1 id="hero-title" className="hero-title">
            {profile.nameLines.map((line) => (
              <span key={line} data-hero-line>{line}</span>
            ))}
          </h1>
          <p className="hero-copy__statement" data-hero-line>{profile.tagline}</p>
          <p className="hero-copy__subhead" data-hero-detail>{profile.bio}</p>

          {/* The only thing the hero asked a reader to do was scroll. These are
              the two things a person who came here to evaluate me actually
              wants: the work, and the document their process needs. */}
          <div className="hero-actions" data-hero-detail>
            <a href="#work" className="hero-action hero-action--primary" data-cursor="link">
              View selected work
              <span aria-hidden="true">→</span>
            </a>
            <Link href="/resume" className="hero-action" data-cursor="link">
              Résumé
            </Link>
          </div>
          <p className="hero-availability" data-hero-detail>{profile.availability}.</p>
        </div>

        {/* The portrait sits inside the instrument rather than beside it. The
            astrolabe held the centre of the hero on its own, which made it a
            second subject competing with the name; framing a face is a job it
            can do without rivalling the copy.

            A real cutout now, not a radial mask over the original red
            backdrop. The mask was a rectangle of fading photograph, which
            could not be laid over type without dimming it; an alpha edge can.
            That is what makes the crowded phone and tablet layouts possible. */}
        <div className="hero-portrait" data-hero-portrait aria-hidden="true">
          <span className="hero-portrait__halo" />
          <Image
            src="/images/portrait-cutout.png"
            alt=""
            width={517}
            height={578}
            priority
            sizes="(max-width: 900px) 62vw, 34vw"
          />
        </div>

        {/* Concentric with the head. The astrolabe behind it was dimmed to 16%
            to stop it competing, which left the right half of the hero holding
            a face and almost nothing else. This puts the instrument back —
            drawn at the scale of the subject, so the two are one object. */}
        <div className="hero-reticle" data-hero-reticle aria-hidden="true">
          <span className="hero-reticle__ring hero-reticle__ring--outer" data-hero-reticle-outer>
            {RETICLE_TICKS.map((tick) => (
              <i
                key={tick}
                data-hero-tick
                className={tick % 3 === 0 ? "is-major" : undefined}
                style={{ transform: `rotate(${tick * 7.5}deg)` }}
              />
            ))}
          </span>
          <span className="hero-reticle__ring hero-reticle__ring--inner" data-hero-reticle-inner />
          <span className="hero-reticle__scan" data-hero-reticle-scan />
          <span className="hero-reticle__crosshair" />
        </div>

        {/* The first screen reports the fleet it is part of. Everything here is
            measured by the same store the console reads — the page is one of
            the applications in the count. */}
        {readout && (
          <div className={`hero-readout hero-readout--${readout.state}`} data-hero-readout>
            <Link href="/console" className="hero-readout__link" data-cursor="link">
              <span className="hero-readout__stat" data-hero-stat>
                <em>Applications</em>
                <strong>
                  {readout.online}
                  <i>/{readout.total}</i>
                </strong>
                <small>operational</small>
              </span>
              <span className="hero-readout__stat" data-hero-stat>
                <em>Uptime</em>
                <strong>{readout.uptime}</strong>
                <small>{readout.uptimeWindow}</small>
              </span>
              <span className="hero-readout__stat" data-hero-stat>
                <em>Response</em>
                <strong>{readout.latency}</strong>
                <small>mean, last check</small>
              </span>
              <span className="hero-readout__stat" data-hero-stat>
                <em>Polled</em>
                <strong>{readout.checked}</strong>
                <small>every 30 s</small>
              </span>
              <span className="hero-readout__go" data-hero-stat aria-hidden="true">
                Console →
              </span>
            </Link>
          </div>
        )}

        <a className="hero-scroll" href="#about" data-cursor="link" data-hero-detail>
          <span>Move down the page</span><ArrowDown size={16} aria-hidden="true" />
        </a>

      </div>
    </section>
  );
}
