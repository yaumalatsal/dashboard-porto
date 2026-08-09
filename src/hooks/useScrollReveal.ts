"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type RevealOptions = {
  delay?: number;
  stagger?: number;
  y?: number;
};

export function useScrollReveal<T extends HTMLElement>({
  delay = 0,
  stagger = 0.08,
  y = 24,
}: RevealOptions = {}) {
  const ref = useRef<T>(null);
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) {
        return;
      }

      const targets = element.querySelectorAll<HTMLElement>("[data-reveal-item]");
      const items = targets.length > 0 ? Array.from(targets) : [element];

      if (prefersReducedMotion) {
        gsap.set(items, { clearProps: "all", opacity: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        items,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          delay,
          stagger,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 82%", once: true },
        },
      );
    },
    { scope: ref, dependencies: [delay, prefersReducedMotion, stagger, y] },
  );

  return ref;
}
