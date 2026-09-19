"use client";

import { useEffect } from "react";
import { useLenis } from "lenis/react";
import { ScrollTrigger } from "@/lib/gsap-config";
import { useUiStore, type AstrolabeSection } from "@/stores/uiStore";

// All seven, in page order. Live Systems and Education were missing, so
// scrolling through either left the active section reading as whatever came
// before it — the header highlighted the wrong entry and, now, so would the
// instrument that replaced the numbered labels.
const sections: { id: AstrolabeSection; selector: string }[] = [
  { id: "hero", selector: "#hero" },
  { id: "about", selector: "#about" },
  { id: "work", selector: "#work" },
  { id: "skills", selector: "#skills" },
  { id: "operations", selector: "#operations" },
  { id: "experience", selector: "#experience" },
  { id: "credentials", selector: "#credentials" },
  { id: "contact", selector: "#contact" },
];

export default function ScrollSectionTracker() {
  const setActiveSection = useUiStore((state) => state.setActiveSection);
  const setHoveredPoint = useUiStore((state) => state.setHoveredPoint);
  const focusedPoint = useUiStore((state) => state.focusedPoint);

  // Hook into Lenis scroll velocity to drive subtle mechanical feedback
  useLenis((lenis) => {
    if (Math.abs(lenis.velocity) > 0.1) {
      // Find the celestial clock element and nudge its drive rotation
      const clockEl = document.querySelector(".celestial-clock-3d");
      if (clockEl) {
        clockEl.setAttribute("data-scroll-velocity", lenis.velocity.toFixed(2));
      }
    }
  });

  useEffect(() => {
    const triggers: ScrollTrigger[] = [];

    sections.forEach(({ id, selector }) => {
      const el = document.querySelector(selector);
      if (!el) return;

      const st = ScrollTrigger.create({
        trigger: el,
        start: "top 55%",
        end: "bottom 45%",
        onEnter: () => {
          setActiveSection(id);
          // Set preview hover state on the celestial globe to track scroll position
          if (!focusedPoint) {
            setHoveredPoint(id === "hero" ? null : id);
          }
        },
        onEnterBack: () => {
          setActiveSection(id);
          if (!focusedPoint) {
            setHoveredPoint(id === "hero" ? null : id);
          }
        },
      });

      triggers.push(st);
    });

    return () => {
      triggers.forEach((st) => st.kill());
    };
  }, [setActiveSection, setHoveredPoint, focusedPoint]);

  return null;
}
