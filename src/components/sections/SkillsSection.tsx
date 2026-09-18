"use client";

import SectionLabel from "@/components/ui/SectionLabel";
import { capabilities } from "@/data/portfolio";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useRef } from "react";

export default function SkillsSection() {
  const graphRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      if (!graphRef.current || prefersReducedMotion) {
        return;
      }

      gsap.timeline()
        .fromTo(".skill-graph__orbit", { opacity: 0, scale: 0.68, rotate: -70 }, { opacity: 1, scale: 1, rotate: 45, duration: 1, ease: "power3.out" }, 0)
        .fromTo(".skill-graph__link", { scaleX: 0 }, { scaleX: 1, duration: 0.8, stagger: 0.08, ease: "power3.out" }, 0.1)
        .fromTo(".skill-graph__node", { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.08, ease: "back.out(1.6)" }, 0.2);
    },
    { scope: graphRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <div id="skills" className="skills-section" tabIndex={-1} aria-labelledby="skills-title">
      <div className="section-shell">
        <SectionLabel number="03" label="Skills" />
        <div className="skills-heading">
          <h2 id="skills-title">One practice.<br />Four layers.</h2>
          <p>The tools change with the job. The standard does not change. I make clear decisions and I build systems that last.</p>
        </div>
        <div className="skill-ledger">
          <div ref={graphRef} className="skill-graph" aria-hidden="true">
            <span className="skill-graph__orbit skill-graph__orbit--outer" />
            <span className="skill-graph__orbit skill-graph__orbit--inner" />
            <span className="skill-graph__link skill-graph__link--one" />
            <span className="skill-graph__link skill-graph__link--two" />
            <span className="skill-graph__link skill-graph__link--three" />
            <span className="skill-graph__link skill-graph__link--four" />
            <span className="skill-graph__node skill-graph__node--one">01</span>
            <span className="skill-graph__node skill-graph__node--two">02</span>
            <span className="skill-graph__node skill-graph__node--three">03</span>
            <span className="skill-graph__node skill-graph__node--four">04</span>
            <span className="skill-graph__pulse" />
          </div>
          <span className="skill-ledger__hub" aria-hidden="true"><i /></span>
          <span className="skill-ledger__bearing skill-ledger__bearing--north" aria-hidden="true">N / Build</span>
          <span className="skill-ledger__bearing skill-ledger__bearing--east" aria-hidden="true">E / Deploy</span>
          <span className="skill-ledger__bearing skill-ledger__bearing--south" aria-hidden="true">S / Connect</span>
          <span className="skill-ledger__bearing skill-ledger__bearing--west" aria-hidden="true">W / Explain</span>
          {capabilities.map((capability) => (
            <article key={capability.title} className="skill-row">
              <span className="skill-row__number">{capability.number}</span>
              <div>
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
              </div>
              <ul aria-label={`${capability.title} skills`}>
                {capability.skills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
