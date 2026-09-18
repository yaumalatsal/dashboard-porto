"use client";

import SectionLabel from "@/components/ui/SectionLabel";
import { profile } from "@/data/portfolio";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useRef } from "react";

const scopes = [
  { value: "Experience", label: "The visible layer" },
  { value: "Software", label: "The working layer" },
  { value: "Infrastructure", label: "The resilient layer" },
] as const;

export default function AboutSection() {
  const atlasRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      if (!atlasRef.current || prefersReducedMotion) {
        return;
      }

      gsap.timeline()
        .fromTo(".atlas__rings", { rotate: -48, scale: 0.78 }, { rotate: 45, scale: 1, duration: 1.2, ease: "power3.out" }, 0)
        .fromTo(".atlas__sweep", { rotate: 22, opacity: 0 }, { rotate: -90, opacity: 1, duration: 1.4, ease: "power3.out" }, 0.1)
        .fromTo(".atlas__needle", { rotate: -118, scaleX: 0.42 }, { rotate: 30, scaleX: 1, duration: 1.1, ease: "back.out(1.4)" }, 0.2);
    },
    { scope: atlasRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <div id="about" className="about-section" tabIndex={-1} aria-labelledby="about-title">
      <div className="section-shell">
        <SectionLabel number="01" label="The Practice" />
        <div className="about-grid">
          <div className="about-copy">
            <h2 id="about-title">
              Every system has a terrain. <em>I make it legible.</em>
            </h2>
            <div className="about-copy__body">
              <p className="about-copy__lead">{profile.bio}</p>
              <p>
                The result may be an immersive story, a network observatory, or a service platform. The method stays the same: observe, map, simplify, build.
              </p>
            </div>
          </div>

          <div ref={atlasRef} className="atlas" aria-label="A visual map connecting craft, code, and infrastructure">
            <span className="atlas__cardinal atlas__cardinal--north">N</span>
            <span className="atlas__cardinal atlas__cardinal--east">E</span>
            <span className="atlas__cardinal atlas__cardinal--south">S</span>
            <span className="atlas__cardinal atlas__cardinal--west">W</span>
            <div className="atlas__terrain" aria-hidden="true"><span /><span /><span /></div>
            <div className="atlas__rings" aria-hidden="true"><span /><span /><span /></div>
            <span className="atlas__sweep" aria-hidden="true" />
            <span className="atlas__needle" aria-hidden="true"><i /></span>
            <span className="atlas__node atlas__node--one">Experience</span>
            <span className="atlas__node atlas__node--two">Software</span>
            <span className="atlas__node atlas__node--three">Infrastructure</span>
            <p className="atlas__caption">One practice</p>
          </div>
        </div>

        <div className="about-stats" aria-label="Practice layers">
          {scopes.map((scope) => (
            <div key={scope.label}>
              <strong>{scope.value}</strong><span>{scope.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
