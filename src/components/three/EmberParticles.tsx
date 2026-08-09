"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function EmberParticles({ count = 108 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { colors, positions } = useMemo(() => {
    const nextPositions = new Float32Array(count * 3);
    const nextColors = new Float32Array(count * 3);
    const ember = new THREE.Color("#b95f31");
    const cool = new THREE.Color("#668b84");
    const ivory = new THREE.Color("#5c493a");

    for (let index = 0; index < count; index += 1) {
      const plane = index % 3;
      const angle = (index / count) * Math.PI * 6 + plane * 0.7;
      const radius = 1.7 + ((index * 37) % 100) / 100 * 1.4;
      const wobble = Math.sin(index * 1.91) * 0.16;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * (plane === 1 ? 0.34 : 0.58);
      const z = plane === 0 ? wobble : plane === 1 ? y * 0.9 : x * 0.32;

      nextPositions.set([x, y, z], index * 3);
      const color = index % 20 === 0 ? ivory : index % 4 === 0 ? cool : ember;
      nextColors.set([color.r, color.g, color.b], index * 3);
    }

    return { colors: nextColors, positions: nextPositions };
  }, [count]);

  useFrame(({ clock }, delta) => {
    if (!pointsRef.current) {
      return;
    }
    pointsRef.current.rotation.z += delta * 0.018;
    pointsRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.15) * 0.08;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.028} sizeAttenuation transparent opacity={0.72} vertexColors depthWrite={false} />
    </points>
  );
}
