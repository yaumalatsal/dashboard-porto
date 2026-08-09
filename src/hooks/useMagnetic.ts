"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap-config";

export function useMagnetic<T extends HTMLElement>(strength = 0.12) {
  const ref = useRef<T>(null);

  const onPointerMove = (event: React.PointerEvent<T>) => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) * strength;
    const y = (event.clientY - rect.top - rect.height / 2) * strength;
    gsap.to(element, { x, y, duration: 0.35, ease: "power2.out", overwrite: true });
  };

  const onPointerLeave = () => {
    if (ref.current) {
      gsap.to(ref.current, { x: 0, y: 0, duration: 0.65, ease: "elastic.out(1, 0.45)" });
    }
  };

  return { ref, onPointerMove, onPointerLeave };
}
