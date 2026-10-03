"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export default function PortfolioMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    if (reducedMotion || !root.current) return;
    const media = gsap.matchMedia();

    // Separate scroll and pointer layers keep the astrolabe's drag coordinates intact.
    media.add("(min-width: 900px)", () => {
      const hero = root.current!.querySelector<HTMLElement>(".obs-hero")!;
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.8 },
      });
      timeline
        .to(".obs-instrument-scroll", { y: 150, scale: 1.12, ease: "none" }, 0)
        .to(".obs-hero-copy", { y: -75, opacity: 0, ease: "none" }, 0)
        .to(".obs-hero-title > span:first-child", { xPercent: -7, y: -95, ease: "none" }, 0)
        .to(".obs-hero-title > span:last-child", { xPercent: 5, y: -145, ease: "none" }, 0)
        .to(".obs-hero-marker", { rotation: 90, y: -60, ease: "none" }, 0);
    });

    /*
     * Everything else that moves with the scroll — section panels, sliding
     * titles, drifting 2D marks, the plates' swing, the screenshots panning
     * inside them, the sign-off name — runs on CSS scroll timelines in
     * observatory.css, off the main thread. As GSAP scrubs they cost ~30
     * script callbacks per frame and took a 4x-throttled CPU down to 7fps.
     * The hero stays here: it is sticky and choreographed across elements.
     */

    // 2.5D plates, pointer layer: the plate turns to face the cursor. Applied
    // to the inner rotator so it composes with the scroll tilt instead of
    // replacing it. Fine pointers only — on touch there is no hover to follow.
    media.add("(hover: hover) and (pointer: fine)", () => {
      const cleanups = gsap.utils.toArray<HTMLElement>(".obs-plate").map((plate) => {
        const depth = plate.querySelector<HTMLElement>(".obs-plate-depth")!;
        // The whole card is the hover target, not just the plate, so the tilt
        // does not snap back while the cursor crosses the title below it.
        const target = plate.closest<HTMLElement>(".obs-project, .obs-about-portrait") ?? plate;
        const turnX = gsap.quickTo(depth, "rotationX", { duration: 0.7, ease: "power3.out" });
        const turnY = gsap.quickTo(depth, "rotationY", { duration: 0.7, ease: "power3.out" });

        const move = (event: PointerEvent) => {
          const bounds = plate.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width - 0.5;
          const y = (event.clientY - bounds.top) / bounds.height - 0.5;
          turnY(x * 14);
          turnX(-y * 10);
        };
        const reset = () => { turnX(0); turnY(0); };

        target.addEventListener("pointermove", move);
        target.addEventListener("pointerleave", reset);
        return () => {
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerleave", reset);
          turnX.tween.kill();
          turnY.tween.kill();
        };
      });
      return () => cleanups.forEach((cleanup) => cleanup());
    });

    media.add("(hover: hover) and (pointer: fine) and (min-width: 900px)", () => {
      const hero = root.current!.querySelector<HTMLElement>(".obs-hero-stage")!;
      const depth = hero.querySelector<HTMLElement>(".obs-instrument-pointer")!;
      const moveX = gsap.quickTo(depth, "x", { duration: 0.9, ease: "power3.out" });
      const moveY = gsap.quickTo(depth, "y", { duration: 0.9, ease: "power3.out" });
      const move = (event: PointerEvent) => {
        // Do not move the target under an active drag or a focused instrument control.
        if (event.buttons || (event.target as Element).closest(".obs-astrolabe-panel")) return;
        const bounds = hero.getBoundingClientRect();
        moveX(((event.clientX - bounds.left) / bounds.width - 0.5) * 24);
        moveY(((event.clientY - bounds.top) / bounds.height - 0.5) * 16);
      };
      const reset = () => { moveX(0); moveY(0); };
      hero.addEventListener("pointermove", move);
      hero.addEventListener("pointerleave", reset);
      depth.addEventListener("pointerdown", reset);
      return () => {
        hero.removeEventListener("pointermove", move);
        hero.removeEventListener("pointerleave", reset);
        depth.removeEventListener("pointerdown", reset);
        moveX.tween.kill();
        moveY.tween.kill();
      };
    });

    gsap.utils.toArray<HTMLElement>(".obs-section-heading, .obs-project-title, .obs-about-copy, .obs-capabilities article").forEach(element => {
      gsap.from(element, {
        y: 30, opacity: 0, duration: 0.7, ease: "power2.out",
        scrollTrigger: { trigger: element, start: "top 94%", once: true },
      });
    });
    return () => media.revert();
  }, { scope: root, dependencies: [reducedMotion], revertOnUpdate: true });

  return <div ref={root} className="observatory">{children}</div>;
}
