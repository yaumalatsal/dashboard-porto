"use client";

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
          .to(".hero-title", { opacity: 0.12, scale: 1.72, ease: "none" }, 0.78);
      });

      media.add("(max-width: 767px)", () => {
        gsap.timeline({
          scrollTrigger: { trigger: shellRef.current, start: "top top", end: "bottom bottom", scrub: 0.75 },
        })
          .to("[data-hero-detail]", { yPercent: -45, opacity: 0, stagger: 0.1, ease: "power2.in" }, 0)
          .to("[data-hero-line]", { yPercent: -65, opacity: 0, stagger: 0.12, ease: "power2.in" }, 0)
          .to("[data-hero-divider]", { scaleY: 0, opacity: 0, ease: "power2.in" }, 0)
          .to("[data-hero-instrument]", { opacity: 0, yPercent: -5, scale: 0.95, ease: "power2.in" }, 0.1);
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
            <span data-hero-line>{profile.name}</span>
          </h1>
          <p className="hero-copy__statement" data-hero-line>{profile.tagline}</p>
          <p className="hero-copy__subhead" data-hero-detail>{profile.bio}</p>
        </div>

        <div className="hero-coordinates" data-hero-detail aria-hidden="true">
          <span>AR 02H 07M</span><span>DEC +23 27</span><span>Aries plate / Orientation</span>
        </div>

        <a className="hero-scroll" href="#about" data-cursor="link" data-hero-detail>
          <span>Follow the constellation</span><ArrowDown size={16} aria-hidden="true" />
        </a>

        <div className="hero-next" aria-hidden="true">
          <span>Next chapter</span><strong>01 / The Practice</strong>
        </div>

        <span className="hero-stage__index" aria-hidden="true">00</span>
      </div>
    </section>
  );
}
