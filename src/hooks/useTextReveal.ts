"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function useTextReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) {
        return;
      }

      const words = element.querySelectorAll<HTMLElement>("[data-word]");
      if (prefersReducedMotion) {
        gsap.set(words, { opacity: 1, yPercent: 0 });
        return;
      }

      gsap.fromTo(
        words,
        { opacity: 0, yPercent: 80 },
        {
          opacity: 1,
          yPercent: 0,
          duration: 0.8,
          stagger: 0.055,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 84%", once: true },
        },
      );
    },
    { scope: ref, dependencies: [prefersReducedMotion] },
  );

  return ref;
}
