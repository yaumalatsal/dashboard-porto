"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { PointLight } from "three";

export default function SceneLighting() {
  const warmRef = useRef<PointLight>(null);
  const coolRef = useRef<PointLight>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (warmRef.current) {
      warmRef.current.intensity = 11 + Math.sin(time * 0.7) * 1.2;
    }
    if (coolRef.current) {
      coolRef.current.intensity = 3.5 + Math.sin(time * 0.7 + Math.PI) * 0.5;
    }
  });

  return (
    <>
      <ambientLight color="#f0d6b5" intensity={1.45} />
      <pointLight ref={warmRef} color="#d47d43" position={[-3, -2, 3]} distance={10} decay={2} />
      <pointLight ref={coolRef} color="#7fa19b" position={[3, 2.5, 4]} distance={9} decay={2} />
    </>
  );
}
