"use client";

import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import {
  FlatPart,
  ToonPart,
  bandGeometry,
  discGeometry,
  outlineMaterial,
  radialMerge,
  toonRamp,
  useGeometryKit,
} from "@/components/three/stylized";

/**
 * The gilt orrery: a standing armillary in polished gold around a faceted emerald core.
 *
 * A different instrument from the brass astrolabe on the hero, not a re-skin — it sits on
 * a pedestal instead of hanging, carries far more (and thinner) rings, and its centre is a
 * cut gem rather than a star map. It shares the illustrated vocabulary from `stylized`:
 * banded toon shading and inverted-hull contours.
 */

// Deep enough to hold shadow: an even, pale gold across every part reads as plastic.
const gold = {
  outline: "#171205",
  shadow: "#0d0b04",
  deep: "#5c4410",
  mid: "#a8851f",
  light: "#d9bb4a",
  pale: "#f2e29a",
  engrave: "#2e2408",
} as const;

const emerald = {
  core: "#0f7a42",
  deep: "#052a18",
  bright: "#57e79a",
  pale: "#b6f7d4",
} as const;

/** Half-width the camera covers, in world units. */
const FRAME_RADIUS = 4.7;
const SPHERE_RADIUS = 1.55;
/** Outer meridian radius — the pedestal's yoke grips this ring at its lowest point. */
const MERIDIAN_RADIUS = 3.3;

function CameraRig() {
  const size = useThree((state) => state.size);
  const zoom = Math.min(size.width, size.height) / (2 * FRAME_RADIUS);
  return <OrthographicCamera makeDefault position={[0, 0, 16]} zoom={zoom} near={0.1} far={80} />;
}

/** A thin gilt ring, optionally engraved with tick divisions and set with cabochons. */
function GiltRing({
  radius,
  rotation,
  width = 0.07,
  depth = 0.16,
  color = gold.mid,
  ticks = 0,
  gems = 0,
  glyphs = 0,
}: {
  radius: number;
  rotation: [number, number, number];
  width?: number;
  depth?: number;
  color?: string;
  ticks?: number;
  gems?: number;
  glyphs?: number;
}) {
  const kit = useGeometryKit(() => ({
    band: bandGeometry(radius - width, radius + width, depth),
    bead: bandGeometry(radius + width, radius + width + 0.022, depth * 1.35),
    ticks: ticks
      ? radialMerge(new THREE.BoxGeometry(width * 1.5, 0.02, depth * 1.06), ticks, radius)
      : null,
    glyphs: glyphs
      ? radialMerge(new THREE.BoxGeometry(width * 0.9, 0.055, depth * 1.1), glyphs, radius)
      : null,
    gems: gems ? radialMerge(new THREE.OctahedronGeometry(0.105, 0), gems, radius) : null,
    gemSeats: gems ? radialMerge(discGeometry(0.135, depth * 1.55, 12), gems, radius) : null,
  }));

  return (
    <group rotation={rotation}>
      <ToonPart geometry={kit.band} color={color} outline={0.02} />
      <ToonPart geometry={kit.bead} color={gold.pale} outline={0.014} />
      {kit.ticks && <ToonPart geometry={kit.ticks} color={gold.engrave} outline={0} />}
      {kit.glyphs && <ToonPart geometry={kit.glyphs} color={gold.engrave} outline={0} />}
      {kit.gemSeats && <ToonPart geometry={kit.gemSeats} color={gold.deep} outline={0.016} />}
      {kit.gems && <FlatPart geometry={kit.gems} color={emerald.bright} outline={0.016} />}
    </group>
  );
}

/** Replaces a polyhedron's smooth spherical normals with per-face ones. */
function faceted(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeVertexNormals();
  return geometry;
}

/** The cut stone at the centre, lit from within. */
function EmeraldCore({ spinRef }: { spinRef: MutableRefObject<number> }) {
  const stoneRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const kit = useGeometryKit(() => ({
    // Polyhedra ship with spherical normals, which shade smooth. Recomputing them on the
    // non-indexed geometry gives one normal per face — actual cut facets.
    stone: faceted(new THREE.IcosahedronGeometry(SPHERE_RADIUS, 0)),
    crown: faceted(new THREE.OctahedronGeometry(SPHERE_RADIUS * 0.95, 0)),
    table: new THREE.OctahedronGeometry(SPHERE_RADIUS * 0.6, 0),
    halo: new THREE.SphereGeometry(SPHERE_RADIUS * 1.34, 32, 24),
  }));

  useFrame(({ clock }) => {
    if (stoneRef.current) {
      stoneRef.current.rotation.y = spinRef.current * 0.6;
      stoneRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.24) * 0.12;
    }
    if (haloRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 1.1) * 0.035;
      haloRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      <group ref={stoneRef}>
        <mesh geometry={kit.stone}>
          <meshToonMaterial color={emerald.core} gradientMap={toonRamp} emissive={emerald.deep} emissiveIntensity={0.8} />
        </mesh>
        <mesh geometry={kit.stone} material={outlineMaterial(0.03)} />
        <mesh geometry={kit.crown} rotation={[0.5, 0.4, 0]}>
          <meshToonMaterial color={emerald.bright} gradientMap={toonRamp} transparent opacity={0.45} />
        </mesh>
        <mesh geometry={kit.table}>
          <meshBasicMaterial color={emerald.pale} transparent opacity={0.6} />
        </mesh>
      </group>

      <mesh ref={haloRef} geometry={kit.halo}>
        <meshBasicMaterial
          color={emerald.bright}
          side={THREE.BackSide}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Offset and dimmed: dead-centre inside the stone it hit every facet head-on, so
          the gem shaded perfectly flat. Off-axis it lights the gold from within and still
          lets the key light carve the facets. */}
      <pointLight position={[0.5, 0.7, 1.1]} intensity={3.2} distance={7.5} color={emerald.bright} />
    </group>
  );
}

/**
 * Turned column, stepped foot and the yoke cradling the meridian ring.
 *
 * Anchored at the meridian's lowest point and built downward, so the column never rises
 * into the sphere — at its old height it speared straight through the cage.
 */
function Pedestal() {
  const kit = useGeometryKit(() => ({
    footOuter: discGeometry(1.32, 0.2, 48),
    footStep: discGeometry(1.02, 0.26, 48),
    footBead: bandGeometry(1.06, 1.18, 0.3, 48),
    column: new THREE.CylinderGeometry(0.17, 0.3, 1.15, 20),
    collar: bandGeometry(0.2, 0.34, 0.18, 24),
    baluster: new THREE.SphereGeometry(0.26, 18, 14),
    knop: new THREE.SphereGeometry(0.15, 18, 18),
    yoke: new THREE.TorusGeometry(0.5, 0.07, 8, 28, Math.PI),
    gems: radialMerge(new THREE.OctahedronGeometry(0.075, 0), 8, 1.12),
  }));

  return (
    <group position={[0, -MERIDIAN_RADIUS, 0]}>
      <ToonPart geometry={kit.yoke} color={gold.mid} outline={0.022} position={[0, -0.1, 0]} rotation={[0, 0, Math.PI]} />
      <ToonPart geometry={kit.knop} color={gold.light} outline={0.022} position={[0, -0.3, 0]} />
      <ToonPart geometry={kit.column} color={gold.mid} outline={0.026} position={[0, -0.95, 0]} />
      <ToonPart geometry={kit.baluster} color={gold.light} outline={0.024} position={[0, -1.42, 0]} scale={[1, 0.72, 1]} />
      <ToonPart geometry={kit.collar} color={gold.light} outline={0.02} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.62, 0]} />
      <ToonPart geometry={kit.footStep} color={gold.mid} outline={0.026} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.78, 0]} />
      <ToonPart geometry={kit.footBead} color={gold.light} outline={0.02} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.78, 0]} />
      <ToonPart geometry={kit.footOuter} color={gold.deep} outline={0.028} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.94, 0]} />
      <FlatPart geometry={kit.gems} color={emerald.bright} outline={0.016} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.76, 0]} />
    </group>
  );
}

function OrreryModel() {
  const cageRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const spinRef = useRef(0);

  useFrame(({ clock }, delta) => {
    spinRef.current += delta * 0.25;
    if (cageRef.current) cageRef.current.rotation.y = spinRef.current * 0.35;
    if (innerRef.current) {
      innerRef.current.rotation.y = -spinRef.current * 0.55;
      innerRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.18) * 0.08;
    }
  });

  const deg = THREE.MathUtils.degToRad;

  return (
    <group rotation={[deg(14), 0, deg(-4)]} position={[0, 0.95, 0]}>
      <Pedestal />

      {/* Fixed frame. The meridian lies in XY so it reads as the big circle you look
          through; in YZ it would be edge-on and collapse into a vertical bar. */}
      <GiltRing radius={MERIDIAN_RADIUS} rotation={[0, 0, 0]} width={0.12} depth={0.26} color={gold.mid} ticks={72} gems={4} />
      <GiltRing radius={MERIDIAN_RADIUS - 0.02} rotation={[deg(84), 0, 0]} width={0.15} depth={0.2} color={gold.light} glyphs={36} gems={8} />
      <GiltRing radius={2.98} rotation={[deg(84), 0, 0]} width={0.04} depth={0.16} color={gold.deep} ticks={48} />

      {/* Slowly turning cage of thin rings. */}
      <group ref={cageRef}>
        <GiltRing radius={2.66} rotation={[deg(90), 0, deg(23.5)]} width={0.12} depth={0.18} color={gold.light} glyphs={12} gems={12} />
        <GiltRing radius={2.42} rotation={[deg(90), 0, 0]} width={0.05} depth={0.15} color={gold.mid} ticks={60} />
        <GiltRing radius={2.22} rotation={[0, 0, deg(18)]} width={0.045} depth={0.14} color={gold.deep} gems={6} />
        <GiltRing radius={2.04} rotation={[deg(62), deg(20), 0]} width={0.04} depth={0.14} color={gold.mid} ticks={40} />
      </group>

      {/* Inner cage, counter-rotating, cradling the stone. */}
      <group ref={innerRef}>
        <GiltRing radius={1.88} rotation={[deg(90), 0, deg(-38)]} width={0.04} depth={0.13} color={gold.light} gems={4} />
        <GiltRing radius={1.88} rotation={[deg(52), deg(28), 0]} width={0.035} depth={0.12} color={gold.mid} />
        <GiltRing radius={1.88} rotation={[deg(-40), deg(-32), 0]} width={0.035} depth={0.12} color={gold.deep} />
      </group>

      <EmeraldCore spinRef={spinRef} />
    </group>
  );
}

export default function EmeraldOrrery3D({ className = "" }: { className?: string }) {
  return (
    <div className={`emerald-orrery ${className}`}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 16], zoom: 90 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <CameraRig />
        {/* Low fill so the gold keeps its shadow side; a bright ambient flattened it. */}
        <ambientLight intensity={0.62} color="#5c5436" />
        <directionalLight position={[-5, 6, 8]} intensity={2.9} color="#fff2bc" />
        <directionalLight position={[6, -2, -5]} intensity={1.1} color="#36b071" />
        <OrreryModel />
      </Canvas>
    </div>
  );
}
