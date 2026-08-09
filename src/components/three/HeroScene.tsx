"use client";

import { memo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import EmberParticles from "@/components/three/EmberParticles";
import SceneLighting from "@/components/three/SceneLighting";
import SigilGeometry from "@/components/three/SigilGeometry";

function HeroScene({ scrollProgress = 0 }: { scrollProgress?: number }) {
  const [quality, setQuality] = useState<"high" | "low">("high");

  return (
    <Canvas
      camera={{ position: [0, 0, 6.4], fov: 42 }}
      dpr={quality === "high" ? [1, 1.5] : 1}
      frameloop="always"
      gl={{ alpha: true, antialias: quality === "high", powerPreference: "high-performance", preserveDrawingBuffer: true }}
    >
      <PerformanceMonitor onDecline={() => setQuality("low")} onIncline={() => setQuality("high")} flipflops={2} />
      <fog attach="fog" args={["#f8f2e8", 5.2, 10]} />
      <SceneLighting />
      <group position={[2, -0.72, 0.2]} scale={0.64}>
        <SigilGeometry scrollProgress={scrollProgress} />
        <EmberParticles count={quality === "high" ? 72 : 38} />
      </group>
    </Canvas>
  );
}

export default memo(HeroScene);
