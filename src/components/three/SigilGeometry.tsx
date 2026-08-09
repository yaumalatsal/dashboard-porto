"use client";

import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUiStore } from "@/stores/uiStore";

export default function SigilGeometry({ scrollProgress = 0 }: { scrollProgress?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const latitudeRef = useRef<THREE.Mesh>(null);
  const longitudeRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const nodePositions = useMemo(
    () => Array.from({ length: 8 }, (_, index) => {
      const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
      return [Math.cos(angle) * 1.18, Math.sin(angle) * 1.18, 0.03] as const;
    }),
    [],
  );
  const horizontalAxis = useMemo(
    () => [new THREE.Vector3(-1.55, 0, 0), new THREE.Vector3(1.55, 0, 0)],
    [],
  );
  const verticalAxis = useMemo(
    () => [new THREE.Vector3(0, -1.55, 0), new THREE.Vector3(0, 1.55, 0)],
    [],
  );

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const uiState = useUiStore.getState();
    const pointer = uiState.pointer;
    const currentProgress = uiState.heroProgress || scrollProgress;
    const maxTilt = THREE.MathUtils.degToRad(4);
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, pointer.y * maxTilt - 0.08, 0.035);
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, -pointer.x * maxTilt + currentProgress * 0.34, 0.035);
    group.position.y = Math.sin(clock.getElapsedTime() * 0.62) * 0.045;
    const scale = 0.92 + currentProgress * 0.1;
    group.scale.setScalar(THREE.MathUtils.lerp(group.scale.x, scale, 0.04));

    if (latitudeRef.current) {
      latitudeRef.current.rotation.x += delta * 0.22;
      latitudeRef.current.rotation.z += delta * 0.08;
    }
    if (longitudeRef.current) {
      longitudeRef.current.rotation.y -= delta * 0.18;
      longitudeRef.current.rotation.z -= delta * 0.05;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.16;
      coreRef.current.rotation.z -= delta * 0.08;
    }
  });

  return (
    <group ref={groupRef} rotation={[-0.08, 0.16, -0.03]}>
      <mesh>
        <torusGeometry args={[1.18, 0.055, 16, 112]} />
        <meshStandardMaterial color="#c98b52" emissive="#6f371d" emissiveIntensity={0.18} metalness={0.52} roughness={0.38} />
      </mesh>
      <mesh ref={latitudeRef} rotation={[Math.PI / 2.55, 0, 0]}>
        <torusGeometry args={[0.86, 0.032, 12, 96]} />
        <meshStandardMaterial color="#dda360" emissive="#6f371d" emissiveIntensity={0.14} metalness={0.48} roughness={0.4} />
      </mesh>
      <mesh ref={longitudeRef} rotation={[0, Math.PI / 2.45, 0]}>
        <torusGeometry args={[0.86, 0.032, 12, 96]} />
        <meshStandardMaterial color="#b97645" emissive="#5b2f1d" emissiveIntensity={0.15} metalness={0.5} roughness={0.4} />
      </mesh>

      <Line points={horizontalAxis} color="#567f78" lineWidth={0.85} transparent opacity={0.72} />
      <Line points={verticalAxis} color="#a95735" lineWidth={0.55} transparent opacity={0.55} />

      {nodePositions.map((position, index) => (
        <mesh key={index} position={position} scale={index === 5 ? 1.45 : 1}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial
            color={index === 5 ? "#dc853f" : "#ead4ad"}
            emissive={index === 5 ? "#b75325" : "#6a3b20"}
            emissiveIntensity={index === 5 ? 1.4 : 0.15}
            metalness={0.35}
            roughness={0.36}
          />
        </mesh>
      ))}

      <mesh ref={coreRef} rotation={[0.34, 0.46, 0.12]}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshPhysicalMaterial
          color="#f0c889"
          emissive="#c8672f"
          emissiveIntensity={0.28}
          metalness={0.18}
          roughness={0.32}
          clearcoat={0.72}
          clearcoatRoughness={0.24}
        />
      </mesh>
      <pointLight color="#d9793d" intensity={6.5} distance={3.2} decay={2} />

      <mesh rotation={[0, 0, -0.56]} position={[0, 0, 0.34]}>
        <boxGeometry args={[0.045, 1.52, 0.028]} />
        <meshStandardMaterial color="#7d5136" emissive="#3e2116" emissiveIntensity={0.12} metalness={0.62} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0, 0.38]}>
        <cylinderGeometry args={[0.11, 0.11, 0.08, 24]} />
        <meshStandardMaterial color="#d2a05e" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, -1.33, 0]}>
        <cylinderGeometry args={[0.22, 0.3, 0.13, 32]} />
        <meshStandardMaterial color="#9d6138" metalness={0.68} roughness={0.36} />
      </mesh>
    </group>
  );
}
