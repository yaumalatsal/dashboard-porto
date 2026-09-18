"use client";

import { useRef, useEffect } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { profile } from "@/data/portfolio";

export default function HeroContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSection = useUiStore((state) => state.activeSection);
  const isLoaderComplete = useUiStore((state) => state.isLoaderComplete);
  const prefersReducedMotion = useReducedMotion();

  const isVisible = activeSection === "hero";

  useGSAP(
    () => {
      if (!containerRef.current || prefersReducedMotion) return;

      if (isVisible && isLoaderComplete) {
        gsap.fromTo(
          "[data-hero-line]",
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.85, stagger: 0.08, ease: "power3.out" }
        );
        gsap.fromTo(
          "[data-hero-detail]",
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.75, stagger: 0.06, delay: 0.2 }
        );
      }
    },
    { scope: containerRef, dependencies: [isVisible, isLoaderComplete, prefersReducedMotion] }
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    if (isVisible) {
      if (prefersReducedMotion) {
        gsap.set(container, { display: "block", opacity: 1 });
      } else {
        gsap.set(container, { display: "block" });
        gsap.to(container, { opacity: 1, duration: 0.6, delay: 0.3, ease: "power2.out" });
      }
    } else {
      if (prefersReducedMotion) {
        gsap.set(container, { display: "none" });
      } else {
        gsap.to(container, {
          opacity: 0,
          duration: 0.35,
          ease: "power2.in",
          onComplete: () => {
            if (container) gsap.set(container, { display: "none" });
          },
        });
      }
    }
  }, [isVisible, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="hero-content-layer"
      aria-hidden={!isVisible}
    >
      <div className="hero-orbit">
        <div className="hero-satellite hero-satellite--identity">
          <div className="hero-satellite__content hero-copy" data-hero-copy>
            <p className="hero-copy__eyebrow" data-hero-detail>
              Celestial systems atelier <span>/</span> Jakarta
            </p>
            <h1 id="hero-title" className="hero-title">
              {profile.nameLines.map((line) => (
              <span key={line} data-hero-line>{line}</span>
            ))}
            </h1>
          </div>
        </div>

        <div className="hero-satellite hero-satellite--manifesto">
          <div className="hero-satellite__content hero-copy__manifesto">
            <p className="hero-copy__statement" data-hero-line>{profile.tagline}</p>
            <p className="hero-copy__subhead" data-hero-detail>
              A creative developer and systems architect building expressive interfaces, useful infrastructure, and digital worlds with a visible point of view.
            </p>
          </div>
        </div>

        <div className="hero-satellite hero-satellite--coordinates">
          <div className="hero-satellite__content hero-coordinates" data-hero-detail aria-hidden="true">
            <span>RA 02H 07M</span>
            <span>DEC +23 27</span>
            <span>Start</span>
          </div>
        </div>
      </div>
    </div>
  );
}
