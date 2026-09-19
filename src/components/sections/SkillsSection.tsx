"use client";

import SectionLabel from "@/components/ui/SectionLabel";
import { capabilities } from "@/data/portfolio";
import { monogram, toolIcon } from "@/data/tool-icons";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useRef, useState } from "react";

/**
 * The four layers, as one continuous band rather than four boxes.
 *
 * The previous layout put each layer in its own bordered quadrant, which read
 * as four separate practices. They are not separate: the same job usually
 * crosses all four, which is the claim the heading makes. So the layers are
 * stacked against a single spine, and the spine is what the eye follows.
 *
 * Every tool carries its own mark where one exists. About half do not —
 * VLAN, routing, firewalling, technical writing and the rest are practices,
 * not products. Those take a monogram in the same chip, so the row stays even
 * instead of collapsing into gaps where a logo could not be found.
 */
export default function SkillsSection() {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Hovering or focusing a layer dims the others, so a reader can isolate one
  // without losing the sense that they belong to a single practice.
  const [active, setActive] = useState<string | null>(null);

  useGSAP(
    () => {
      if (!rootRef.current || prefersReducedMotion) {
        return;
      }

      gsap
        .timeline({
          scrollTrigger: { trigger: rootRef.current, start: "top 72%" },
        })
        .fromTo(
          ".layer-spine__run",
          { scaleY: 0 },
          { scaleY: 1, duration: 1.1, ease: "power3.out", transformOrigin: "top" },
          0,
        )
        .fromTo(
          ".layer",
          { opacity: 0, y: 26 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power3.out" },
          0.15,
        )
        .fromTo(
          ".tool",
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.4, stagger: 0.015, ease: "back.out(1.5)" },
          0.35,
        );
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] },
  );

  return (
    <div
      id="skills"
      className="skills-section"
      tabIndex={-1}
      aria-labelledby="skills-title"
    >
      <div className="section-shell">
        <SectionLabel number="03" label="Skills" />

        <div className="skills-heading">
          <h2 id="skills-title">
            One practice.
            <br />
            Four layers.
          </h2>
          <p>
            The tools change with the job. This is what I have used in work that
            shipped, not what I have read about. Where a layer is thin, it is
            thin here too.
          </p>
        </div>

        <div
          ref={rootRef}
          className={`layers${active ? " layers--focused" : ""}`}
          onMouseLeave={() => setActive(null)}
        >
          {/* One continuous line through all four layers: the spine is the
              argument that these are not four separate disciplines. */}
          <div className="layer-spine" aria-hidden="true">
            <span className="layer-spine__run" />
          </div>

          {capabilities.map((capability) => {
            const isActive = active === capability.title;

            return (
              <section
                key={capability.title}
                className={`layer${isActive ? " layer--active" : ""}`}
                aria-labelledby={`layer-${capability.number}`}
                onMouseEnter={() => setActive(capability.title)}
                onFocus={() => setActive(capability.title)}
                onBlur={() => setActive(null)}
                tabIndex={0}
              >
                <div className="layer__marker" aria-hidden="true">
                  <span className="layer__numeral">{capability.number}</span>
                </div>

                <div className="layer__body">
                  <h3 id={`layer-${capability.number}`}>{capability.title}</h3>
                  <p>{capability.description}</p>

                  <ul className="tools" aria-label={`${capability.title} tools`}>
                    {capability.skills.map((skill) => {
                      const icon = toolIcon(skill);

                      return (
                        <li key={skill} className="tool">
                          <span className="tool__mark" aria-hidden="true">
                            {icon ? (
                              <svg viewBox="0 0 24 24" role="presentation">
                                <path d={icon.path} />
                              </svg>
                            ) : (
                              <em>{monogram(skill)}</em>
                            )}
                          </span>
                          <span className="tool__name">{skill}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
