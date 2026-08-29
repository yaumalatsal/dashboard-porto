"use client";

import { useRef } from "react";
import SectionLabel from "@/components/ui/SectionLabel";
import { experiences } from "@/data/portfolio";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { Calendar, Globe2, Mic2, Users, Award } from "lucide-react";

const typeIcons = {
  conference: Mic2,
  community: Users,
  organization: Award,
  event: Globe2,
};

export default function ExperienceSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      if (!containerRef.current || prefersReducedMotion) return;

      gsap.fromTo(
        ".experience-card",
        { opacity: 0, y: 32 },
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 78%",
            once: true,
          },
        }
      );
    },
    { scope: containerRef, dependencies: [prefersReducedMotion] }
  );

  return (
    <section
      ref={containerRef}
      id="experience"
      className="experience-section"
      tabIndex={-1}
      aria-labelledby="experience-title"
    >
      <div className="section-shell">
        <SectionLabel number="04" label="Field Journal" />

        <div className="experience-intro">
          <h2 id="experience-title">
            Beyond the workbench.<br />
            <em>Community &amp; discourse.</em>
          </h2>
          <p>
            Conferences spoken at, developer communities nurtured, and civic initiatives shaped outside daily client practice.
          </p>
        </div>

        <div className="experience-grid">
          {experiences.map((item, index) => {
            const Icon = typeIcons[item.type] || Globe2;
            return (
              <article
                key={item.title + index}
                className="experience-card"
                data-cursor="star"
                data-cursor-label={item.type}
              >
                <div className="experience-card__header">
                  <span className="experience-card__num">{item.number}</span>
                  <div className="experience-card__type">
                    <Icon size={13} aria-hidden="true" />
                    <span>{item.type}</span>
                  </div>
                </div>

                <div className="experience-card__body">
                  <h3 className="experience-card__title">{item.title}</h3>
                  <p className="experience-card__role">{item.role}</p>
                  <p className="experience-card__desc">{item.description}</p>
                </div>

                <div className="experience-card__footer">
                  <div className="experience-card__period">
                    <Calendar size={12} aria-hidden="true" />
                    <span>{item.year}</span>
                  </div>
                  <span className="experience-card__sigil" aria-hidden="true" />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
