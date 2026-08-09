"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type CelestialGlobe3DProps = {
  rotation: { x: number; y: number };
  reducedMotion: boolean;
};

function CelestialBody({ rotation, reducedMotion }: CelestialGlobe3DProps) {
  const globeRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Points>(null);
  const starPositions = useMemo(() => {
    const count = 110;
    const positions = new Float32Array(count * 3);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * index;
      positions[index * 3] = Math.cos(theta) * radius * 2.08;
      positions[index * 3 + 1] = y * 2.08;
      positions[index * 3 + 2] = Math.sin(theta) * radius * 2.08;
    }

    return positions;
  }, []);

  useFrame((_, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.x = THREE.MathUtils.lerp(globeRef.current.rotation.x, THREE.MathUtils.degToRad(rotation.x), reducedMotion ? 1 : 0.1);
      globeRef.current.rotation.y = THREE.MathUtils.lerp(globeRef.current.rotation.y, THREE.MathUtils.degToRad(rotation.y), reducedMotion ? 1 : 0.1);
    }
    if (starsRef.current && !reducedMotion) {
      starsRef.current.rotation.z += delta * 0.012;
    }
  });

  return (
    <group ref={globeRef}>
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial color="#1b0b2c" emissive="#160624" emissiveIntensity={0.45} metalness={0.18} roughness={0.82} />
      </mesh>
      <mesh scale={1.006}>
        <sphereGeometry args={[2, 28, 20]} />
        <meshBasicMaterial color="#b77bd0" wireframe transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <mesh scale={1.045}>
        <sphereGeometry args={[2, 48, 48]} />
        <meshBasicMaterial color="#7f3fa0" side={THREE.BackSide} transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#f6d98f" size={0.025} sizeAttenuation transparent opacity={0.86} depthWrite={false} />
      </points>
    </group>
  );
}

export default function CelestialGlobe3D({ rotation, reducedMotion }: CelestialGlobe3DProps) {
  return (
    <Canvas
      className="orrery-globe-3d"
      aria-hidden="true"
      camera={{ position: [0, 0, 5.7], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={1.1} color="#7c5a90" />
      <directionalLight position={[-3, 4, 5]} intensity={1.7} color="#f1cf81" />
      <pointLight position={[3, -2, 3]} intensity={0.65} color="#7c3c9b" />
      <CelestialBody rotation={rotation} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
