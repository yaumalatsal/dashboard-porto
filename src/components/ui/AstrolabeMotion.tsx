"use client";

import { useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap } from "@/lib/gsap-config";

export default function AstrolabeMotion() {
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const traces = gsap.utils.toArray<HTMLElement>("[data-instrument-trace]");

      if (prefersReducedMotion) {
        gsap.set(traces, { "--trace-angle": "0deg", "--trace-progress": 1 });
        return;
      }

      traces.forEach((trace) => {
        const trigger = trace.closest("section, article, header, footer") ?? trace;
        gsap.fromTo(
          trace,
          { "--trace-angle": "-42deg", "--trace-progress": 0 },
          {
            "--trace-angle": "318deg",
            "--trace-progress": 1,
            ease: "none",
            scrollTrigger: {
              trigger,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.8,
            },
          },
        );
      });
    },
    { dependencies: [prefersReducedMotion] },
  );

  useEffect(() => {
    const planes = Array.from(document.querySelectorAll<HTMLElement>("[data-instrument-tilt]"));

    if (prefersReducedMotion) {
      gsap.set(planes, { "--instrument-rx": "0deg", "--instrument-ry": "0deg", "--instrument-z": "0px" });
      return;
    }

    const cleanups = planes.map((plane) => {
      const handlePointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch") {
          return;
        }

        if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea")) {
          gsap.set(plane, {
            "--instrument-rx": "0deg",
            "--instrument-ry": "0deg",
            "--instrument-z": "0px",
          });
          return;
        }

        const bounds = plane.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;

        gsap.to(plane, {
          "--instrument-rx": `${y * -2.2}deg`,
          "--instrument-ry": `${x * 2.6}deg`,
          "--instrument-z": "5px",
          duration: 0.75,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      const handlePointerLeave = () => {
        gsap.to(plane, {
          "--instrument-rx": "0deg",
          "--instrument-ry": "0deg",
          "--instrument-z": "0px",
          duration: 1,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      plane.addEventListener("pointermove", handlePointerMove);
      plane.addEventListener("pointerleave", handlePointerLeave);

      return () => {
        plane.removeEventListener("pointermove", handlePointerMove);
        plane.removeEventListener("pointerleave", handlePointerLeave);
      };
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [prefersReducedMotion]);

  return null;
}
