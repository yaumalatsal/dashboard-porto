"use client";

import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap } from "@/lib/gsap-config";

const maximumTravel = 72;

export default function ParallaxField() {
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const layers = gsap.utils.toArray<HTMLElement>("[data-parallax]");

      if (prefersReducedMotion) {
        gsap.set(layers, { clearProps: "transform" });
        return;
      }

      layers.forEach((layer) => {
        const configuredSpeed = Number.parseFloat(layer.dataset.parallaxSpeed ?? "0.16");
        const speed = Number.isFinite(configuredSpeed) ? configuredSpeed : 0.16;
        const travel = Math.min(Math.max(Math.abs(speed) * 180, 10), maximumTravel) * Math.sign(speed || 1);
        const axis = layer.dataset.parallaxAxis === "x" ? "x" : "y";
        const rotate = Number.parseFloat(layer.dataset.parallaxRotate ?? "0");
        const trigger = layer.closest("section, footer") ?? layer;

        gsap.fromTo(
          layer,
          { [axis]: -travel, rotate: Number.isFinite(rotate) ? -rotate : 0 },
          {
            [axis]: travel,
            rotate: Number.isFinite(rotate) ? rotate : 0,
            ease: "none",
            scrollTrigger: {
              trigger,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.75,
            },
          },
        );
      });
    },
    { dependencies: [prefersReducedMotion] },
  );

  return null;
}
