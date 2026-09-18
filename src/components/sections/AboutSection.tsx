"use client";

import SectionLabel from "@/components/ui/SectionLabel";
import { profile } from "@/data/portfolio";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useRef, useState } from "react";

/**
 * The three layers, as a instrument you can interrogate.
 *
 * The dial previously carried three static labels and a separate row of
 * captions underneath, so the labels and their meaning never met. Selecting a
 * node now drives both: the dial marks the chosen layer, and one panel below
 * says what that layer means and what sits in it.
 *
 * Keyboard reachable, because a dial that only answers a mouse is a picture.
 */

/** 60 marks around the bezel; every fifth is drawn long. */
const TICKS = Array.from({ length: 60 }, (_, i) => i);

type Layer = {
  id: "experience" | "software" | "infrastructure";
  name: string;
  caption: string;
  summary: string;
  detail: string[];
};

const LAYERS: Layer[] = [
  {
    id: "experience",
    name: "Experience",
    caption: "The visible layer",
    summary:
      "What a person actually touches: the screen, the form, the report they have to read on a Monday morning.",
    detail: [
      "Interfaces built with React and Inertia",
      "Dashboards that answer a question, not decorate one",
      "Printed and exported output — PDF permits, Excel recaps",
    ],
  },
  {
    id: "software",
    name: "Software",
    caption: "The working layer",
    summary:
      "The rules underneath: what a permit may do, who approves it, how a figure is derived and where it is kept.",
    detail: [
      "Laravel applications with role-based approval flows",
      "Data models that make a comparison a query",
      "Background work, exports and scheduled synchronisation",
    ],
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    caption: "The resilient layer",
    summary:
      "The ground it stands on: the container, the reverse proxy, the certificate, the switch in the rack.",
    detail: [
      "Docker and Nginx on my own servers",
      "TLS, DNS and the deploy pipeline that ships to them",
      "MikroTik routing and the physical network below it",
    ],
  },
];

export default function AboutSection() {
  const atlasRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Defaults to the first layer rather than nothing: an empty panel on load
  // would make the dial look broken until touched.
  const [activeId, setActiveId] = useState<Layer["id"]>("experience");
  const active = LAYERS.find((l) => l.id === activeId) ?? LAYERS[0];

  useGSAP(
    () => {
      if (!atlasRef.current || prefersReducedMotion) {
        return;
      }

      // Entry: the instrument spins up.
      gsap
        .timeline()
        .fromTo(
          ".atlas__rings",
          { rotate: -48, scale: 0.78 },
          { rotate: 45, scale: 1, duration: 1.2, ease: "power3.out" },
          0,
        )
        .fromTo(
          ".atlas__sweep",
          { rotate: 22, opacity: 0 },
          { rotate: -90, opacity: 1, duration: 1.4, ease: "power3.out" },
          0.1,
        )
        .fromTo(
          ".atlas__tick",
          { opacity: 0 },
          { opacity: 1, duration: 0.5, stagger: 0.006, ease: "none" },
          0.2,
        );

      // Then it keeps running. A dial that settles and stops is a drawing of
      // an instrument; the whole point of the thing is that it is still
      // reading. Each ring has its own period so they never lock into one
      // rotating disc.
      const idle = [
        gsap.to(".atlas__rings", {
          rotate: "+=360",
          duration: 96,
          ease: "none",
          repeat: -1,
        }),
        gsap.to(".atlas__sweep", {
          rotate: "-=360",
          duration: 61,
          ease: "none",
          repeat: -1,
        }),
        gsap.to(".atlas__radar", {
          rotate: "+=360",
          duration: 7.5,
          ease: "none",
          repeat: -1,
        }),
        gsap.to(".atlas__terrain", {
          rotate: "+=360",
          duration: 240,
          ease: "none",
          repeat: -1,
        }),
      ];

      // Pointer tilt. The dial already has perspective; using it makes the
      // thing feel like an object under glass rather than a flat badge.
      const rotX = gsap.quickTo(".atlas__plate", "rotationX", {
        duration: 0.9,
        ease: "power3.out",
      });
      const rotY = gsap.quickTo(".atlas__plate", "rotationY", {
        duration: 0.9,
        ease: "power3.out",
      });

      const el = atlasRef.current;
      const onMove = (event: PointerEvent) => {
        const box = el.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        rotX(-y * 13);
        rotY(x * 13);
      };
      const onLeave = () => {
        rotX(0);
        rotY(0);
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);

      return () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
        idle.forEach((tween) => tween.kill());
      };
    },
    { scope: atlasRef, dependencies: [prefersReducedMotion] },
  );

  // The needle points at whichever layer is selected. Driven here rather than
  // in the timeline so it follows selection, not just page load.
  useGSAP(
    () => {
      if (!atlasRef.current) {
        return;
      }

      const bearing = { experience: -52, software: 34, infrastructure: 146 }[
        activeId
      ];

      if (prefersReducedMotion) {
        gsap.set(".atlas__needle", { rotate: bearing });
        return;
      }

      // Overshoots and settles. A magnetised needle does not arrive politely,
      // and the overshoot is what sells the dial as a physical reading.
      gsap.to(".atlas__needle", {
        rotate: bearing,
        duration: 1.15,
        ease: "elastic.out(1, 0.55)",
      });

      // A ping leaves the hub every time the bearing changes, so a selection
      // registers in the instrument and not only in the panel below.
      gsap.fromTo(
        ".atlas__ping",
        { scale: 0.2, opacity: 0.55 },
        { scale: 1, opacity: 0, duration: 1.1, ease: "power2.out" },
      );
    },
    { scope: atlasRef, dependencies: [activeId, prefersReducedMotion] },
  );

  return (
    <div
      id="about"
      className="about-section"
      tabIndex={-1}
      aria-labelledby="about-title"
    >
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
                The result may be an immersive story, a network observatory, or
                a service platform. The method stays the same: observe, map,
                simplify, build.
              </p>
            </div>
          </div>

          <div
            ref={atlasRef}
            className="atlas"
            role="group"
            aria-label="Three layers of one practice"
          >
            <span className="atlas__cardinal atlas__cardinal--north">N</span>
            <span className="atlas__cardinal atlas__cardinal--east">E</span>
            <span className="atlas__cardinal atlas__cardinal--south">S</span>
            <span className="atlas__cardinal atlas__cardinal--west">W</span>
            {/* Everything that tilts sits on one plate, so the parts keep
                their depth relative to each other instead of each tilting
                about its own centre. */}
            <div className="atlas__plate" aria-hidden="true">
              <div className="atlas__bezel">
                {TICKS.map((tick) => (
                  <span
                    key={tick}
                    className={`atlas__tick${tick % 5 === 0 ? " atlas__tick--major" : ""}`}
                    style={{ transform: `rotate(${tick * 6}deg)` }}
                  />
                ))}
              </div>
              <div className="atlas__terrain">
                <span />
                <span />
                <span />
              </div>
              <div className="atlas__rings">
                <span />
                <span />
                <span />
              </div>
              <span className="atlas__sweep" />
              {/* The wedge that says the instrument is still sampling. */}
              <span className="atlas__radar" />
              <span className="atlas__ping" />
              {/* The mount carries the hunt (a CSS animation), the needle
                  carries the bearing (GSAP). Separate elements, so the two
                  rotations compose instead of overwriting each other. */}
              <span className="atlas__needle-mount">
                <span className="atlas__needle">
                  <i />
                </span>
              </span>
            </div>

            {LAYERS.map((layer, i) => (
              <button
                key={layer.id}
                type="button"
                className={`atlas__node atlas__node--${["one", "two", "three"][i]}${
                  layer.id === activeId ? " atlas__node--active" : ""
                }`}
                aria-pressed={layer.id === activeId}
                onClick={() => setActiveId(layer.id)}
                onMouseEnter={() => setActiveId(layer.id)}
                onFocus={() => setActiveId(layer.id)}
              >
                {layer.name}
              </button>
            ))}

            <p className="atlas__caption">One practice</p>
          </div>
        </div>

        {/* One panel, driven by the dial. Replaces three static captions that
            said what each layer was called but never what it held. */}
        <div className="layer-read" aria-live="polite">
          <div className="layer-read__head">
            <span className="layer-read__index">
              0{LAYERS.findIndex((l) => l.id === activeId) + 1} / 03
            </span>
            <h3>{active.name}</h3>
            <span className="layer-read__caption">{active.caption}</span>
          </div>
          <p className="layer-read__summary">{active.summary}</p>
          <ul className="layer-read__detail">
            {active.detail.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
