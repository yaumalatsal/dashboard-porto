"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useUiStore } from "@/stores/uiStore";

export default function CustomCursor() {
  const layerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("");
  const prefersReducedMotion = useReducedMotion();
  const setPointer = useUiStore((state) => state.setPointer);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setEnabled(media.matches && !prefersReducedMotion);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!enabled || !ringRef.current || !dotRef.current) {
      return;
    }

    const ring = ringRef.current;
    const ringX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3.out" });
    const dotX = gsap.quickTo(dotRef.current, "x", { duration: 0.08 });
    const dotY = gsap.quickTo(dotRef.current, "y", { duration: 0.08 });

    const onPointerMove = (event: PointerEvent) => {
      layerRef.current?.classList.add("is-visible");
      ringX(event.clientX);
      ringY(event.clientY);
      dotX(event.clientX);
      dotY(event.clientY);
      setPointer({
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1,
      });

      const target = (event.target as Element | null)?.closest<HTMLElement>("[data-cursor]");
      const nextLabel = target?.dataset.cursorLabel ?? (target?.dataset.cursor === "project" ? "View" : "");
      setLabel(nextLabel);
      ring.dataset.mode = target?.dataset.cursor ?? "";
      ring.classList.toggle("is-active", Boolean(target));
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [enabled, setPointer]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="cursor-layer" ref={layerRef} aria-hidden="true">
      <div className="cursor-ring" ref={ringRef}>
        <div className="cursor-astrolabe">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer scale ring */}
            <circle cx="50" cy="50" r="48" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
            <circle cx="50" cy="50" r="46" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="2" strokeDasharray="1 3" className="astro-spin-1" />
            
            {/* Zodiac / Ecliptic ring (offset circle) */}
            <g className="astro-spin-2">
              <circle cx="50" cy="42" r="32" stroke="rgba(216, 155, 78, 0.5)" strokeWidth="0.5" />
              <circle cx="50" cy="42" r="34" stroke="rgba(216, 155, 78, 0.3)" strokeWidth="0.5" strokeDasharray="4 2" />
            </g>

            {/* Inner Tympan geometry */}
            <g className="astro-spin-3">
              <circle cx="50" cy="50" r="28" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="0.5" />
              <path d="M 22 50 A 28 28 0 0 1 78 50" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.5" />
              <path d="M 50 22 A 28 28 0 0 1 50 78" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.5" />
            </g>

            {/* Alidade / Needle */}
            <g className="astro-spin-4">
              <line x1="15" y1="50" x2="85" y2="50" stroke="rgba(216, 155, 78, 0.9)" strokeWidth="1" />
              <polygon points="85,50 78,47 78,53" fill="rgba(216, 155, 78, 0.9)" />
              <circle cx="50" cy="50" r="3" fill="rgba(216, 155, 78, 1)" />
              <circle cx="50" cy="50" r="1.5" fill="#111" />
            </g>
          </svg>
        </div>
        <span>{label}</span>
      </div>
      <div className="cursor-dot" ref={dotRef} />
    </div>
  );
}
