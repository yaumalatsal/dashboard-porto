"use client";

import type { ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { ScrollTrigger } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";

function ScrollTriggerSync() {
  useLenis(() => ScrollTrigger.update());

  return null;
}

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return children;
  }

  return (
    <ReactLenis
      root
      options={{ autoRaf: true, lerp: 0.085, smoothWheel: true, syncTouch: true }}
    >
      <ScrollTriggerSync />
      {children}
    </ReactLenis>
  );
}
