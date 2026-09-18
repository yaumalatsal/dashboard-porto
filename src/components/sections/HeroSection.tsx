"use client";

import Image from "next/image";
import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useUiStore } from "@/stores/uiStore";
import { profile } from "@/data/portfolio";

export default function HeroSection() {
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
      }

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
            // Slower than the copy, so the hero has depth rather than one
            // flat plane sliding away.
            .to("[data-hero-portrait]", { yPercent: -12, scale: 1.06, opacity: 0, ease: "none" }, 0.1);
      });

      media.add("(max-width: 767px)", () => {
        gsap.timeline({
          scrollTrigger: { trigger: shellRef.current, start: "top top", end: "bottom bottom", scrub: 0.75 },
        })
          .to("[data-hero-detail]", { yPercent: -45, opacity: 0, stagger: 0.1, ease: "power2.in" }, 0)
          .to("[data-hero-line]", { yPercent: -65, opacity: 0, stagger: 0.12, ease: "power2.in" }, 0)
          .to("[data-hero-divider]", { scaleY: 0, opacity: 0, ease: "power2.in" }, 0)
          .to("[data-hero-instrument]", { opacity: 0, yPercent: -5, scale: 0.95, ease: "power2.in" }, 0.1)
            .to("[data-hero-portrait]", { opacity: 0, yPercent: -8, ease: "power2.in" }, 0);
      });

      return () => media.revert();
    },
    { scope: shellRef, dependencies: [isLoaderComplete, prefersReducedMotion] },
  );

  return (
    <section ref={shellRef} id="hero" className="hero-shell" aria-labelledby="hero-title">
      <div className="hero-stage">
        <div className="hero-transition-line" data-hero-divider aria-hidden="true" />

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
        </div>

        {/* The portrait sits inside the instrument rather than beside it. The
            astrolabe held the centre of the hero on its own, which made it a
            second subject competing with the name; framing a face is a job it
            can do without rivalling the copy.

            Masked rather than cut out: a radial fade centred on the head
            dissolves the shoulders and the original red backdrop into the
            page, so the edge is a gradient and nothing is traced by hand. */}
        <div className="hero-portrait" data-hero-portrait aria-hidden="true">
          <span className="hero-portrait__halo" />
          <Image
            src="/images/portrait.png"
            alt=""
            width={517}
            height={578}
            priority
            sizes="(max-width: 900px) 62vw, 34vw"
          />
        </div>

        <a className="hero-scroll" href="#about" data-cursor="link" data-hero-detail>
          <span>Move down the page</span><ArrowDown size={16} aria-hidden="true" />
        </a>

      </div>
    </section>
  );
}
