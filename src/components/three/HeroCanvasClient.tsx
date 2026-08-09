"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useUiStore } from "@/stores/uiStore";

const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
  ssr: false,
  loading: () => <RelicFallback />,
});

function RelicFallback() {
  return (
    <div className="relic-fallback" aria-hidden="true">
      <span className="relic-fallback__ring relic-fallback__ring--outer" />
      <span className="relic-fallback__ring relic-fallback__ring--inner" />
      <span className="relic-fallback__line" />
      <span className="relic-fallback__core" />
    </div>
  );
}

export default function HeroCanvasClient({
  className = "",
  scrollProgress = 0,
}: {
  className?: string;
  scrollProgress?: number;
}) {
  const [isCoarseOrCompact, setIsCoarseOrCompact] = useState(true);
  const [isSceneReady, setSceneReady] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const isLoaderComplete = useUiStore((state) => state.isLoaderComplete);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setIsCoarseOrCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isCoarseOrCompact || prefersReducedMotion || !isLoaderComplete) {
      return;
    }

    const revealScene = () => setSceneReady(true);
    const timeout = window.setTimeout(revealScene, 2800);
    window.addEventListener("pointermove", revealScene, { once: true, passive: true });
    window.addEventListener("wheel", revealScene, { once: true, passive: true });

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointermove", revealScene);
      window.removeEventListener("wheel", revealScene);
    };
  }, [isCoarseOrCompact, isLoaderComplete, prefersReducedMotion]);

  return (
    <div className={`hero-canvas ${className}`} aria-hidden="true">
      {isCoarseOrCompact || prefersReducedMotion || !isSceneReady
        ? <RelicFallback />
        : <HeroScene scrollProgress={scrollProgress} />}
    </div>
  );
}
