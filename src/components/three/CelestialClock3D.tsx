"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import type { AstrolabeSection } from "@/stores/uiStore";
import {
  ariesConstellation,
  celestialMapCoordinates,
  constellationIdForStar,
  piscesConstellation,
  type CelestialStar,
  type Constellation,
  type ConstellationId,
} from "@/data/constellations";
import {
  FlatPart,
  ToonPart,
  bandGeometry,
  discGeometry,
  mergeParts,
  palette,
  radialMerge,
  useGeometryKit,
} from "@/components/three/stylized";
import {
  ESCAPEMENT_SEAT,
  RING_PITCH_RADIUS,
  RING_TEETH,
  TRAIN_PLANE_Z,
  WHEEL_ORBIT_RADIUS,
  WHEEL_PITCH_RADIUS,
  WHEEL_TEETH,
  ORBIT_RATES,
  advanceTransmission,
  approach,
  createTransmission,
  seatAngle,
  wheelAngle,
  type Transmission,
} from "@/components/three/mechanism";

export type ClockStar = {
  id: AstrolabeSection;
  key: string;
  name: string;
  designation: string;
  chapter: string;
  level: string;
  status: string;
  ra: number;
  dec: number;
  magnitude: number;
  size: number;
};

type CelestialClock3DProps = {
  stars: ClockStar[];
  selectedId: AstrolabeSection | null;
  hoveredId: AstrolabeSection | null;
  orientationRef: MutableRefObject<{ x: number; y: number }>;
  globeRotationRef: MutableRefObject<{ x: number; y: number }>;
  driveRotationRef: MutableRefObject<number>;
  zoomRef: MutableRefObject<number>;
  reducedMotion: boolean;
  isRevealed: boolean;
  isReading: boolean;
  isPointerOver: boolean;
  activeConstellation: ConstellationId;
  onOpenStar: (star: ClockStar) => void;
  onHoverStar: (id: AstrolabeSection | null) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  isSpinning: boolean;
  /** What a drag from the current pointer position would do, for the cursor readout. */
  hoverZone: "sky" | "frame";
};

/** Half-width the camera must cover, in world units. Everything is authored to fit inside it. */
const FRAME_RADIUS = 5.15;
/**
 * The canvas is drawn larger than the instrument so zooming has somewhere to go. Without
 * this the camera frame exactly filled the canvas, and any zoom past ~1.17 sheared the
 * case off against the canvas rectangle — a hard square crop in the middle of the page.
 * Must stay in step with the canvas inset in globals.css.
 */
const CANVAS_OVERSCAN = 1.26;
const GLOBE_RADIUS = 2.45;
const REST_ROLL = THREE.MathUtils.degToRad(-6);
/**
 * The case sits back at 42°, so without compensation you look down onto the globe and its
 * equator lands near the bottom edge with every star crowded there. Elevating the polar
 * axis by the same amount squares the map to the viewer — which is exactly what the
 * latitude adjustment on a real celestial globe does — while the case keeps its tilt.
 */
const MOUNT_ELEVATION = THREE.MathUtils.degToRad(42);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function settle(current: number, target: number, damping: number): number {
  return Math.abs(current - target) < 0.0001 ? target : THREE.MathUtils.lerp(current, target, damping);
}

function settleAngle(current: number, target: number, damping: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < 0.0001 ? target : current + diff * damping;
}

/** Windowed sub-progress, for staging one assembly step against the whole sequence. */
function stage(progress: number, start: number, end: number): number {
  return THREE.MathUtils.clamp((progress - start) / (end - start), 0, 1);
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeBack(t: number): number {
  return 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
}

/** One constellation owns the map at a time. The short empty beat between pages keeps
 * the figures from becoming a blended knot during the automatic transition. */
function constellationTargetLevel(
  constellation: ConstellationId,
  time: number,
  spotlight: ConstellationId | null,
  reducedMotion: boolean,
): number {
  if (spotlight) return spotlight === constellation ? 1 : 0;
  if (reducedMotion) return constellation === "aries" ? 1 : 0;

  const blend = 0.5 + Math.cos((time / 14) * Math.PI * 2) * 0.5;
  const pageSignal = constellation === "aries" ? blend : 1 - blend;
  return THREE.MathUtils.smoothstep(pageSignal, 0.56, 0.86);
}

/**
 * Stars are placed by right ascension and declination, spread around the entire
 * celestial sphere — so turning the globe genuinely brings unseen chapters into view
 * instead of just sliding a flat cluster around.
 */
export function starPosition(star: Pick<CelestialStar, "key" | "ra" | "dec">, radius = GLOBE_RADIUS): THREE.Vector3 {
  // The chart data packs the asterism into a narrow band (x 20–45), which put five stars
  // and their labels on top of each other. Spread about the group's centre keeps the
  // shape but opens it across the visible hemisphere.
  const mapCoordinates = celestialMapCoordinates(star);
  const longitude = THREE.MathUtils.degToRad(mapCoordinates.longitude);
  const latitude = THREE.MathUtils.degToRad(mapCoordinates.latitude);
  const cosLatitude = Math.cos(latitude);

  return new THREE.Vector3(
    Math.sin(longitude) * cosLatitude * radius,
    Math.sin(latitude) * radius,
    Math.cos(longitude) * cosLatitude * radius,
  );
}

/** Walks great-circle arcs between the stars so the constellation lies on the sphere. */
function buildConstellationArc(fromStar: CelestialStar, toStar: CelestialStar, radius: number): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = [];
  const from = starPosition(fromStar, 1);
  const to = starPosition(toStar, 1);

  for (let step = 0; step <= 20; step += 1) {
    points.push(from.clone().lerp(to, step / 20).normalize().multiplyScalar(radius));
  }

  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
}

/** Frames the instrument for the hero's size, and lets the wheel dolly in on the sphere. */
function CameraRig({
  zoomRef,
  reducedMotion,
  isFocused,
  isPointerOver,
}: {
  zoomRef: MutableRefObject<number>;
  reducedMotion: boolean;
  isFocused: boolean;
  isPointerOver: boolean;
}) {
  const size = useThree((state) => state.size);
  const baseZoom = Math.min(size.width, size.height) / (2 * FRAME_RADIUS * CANVAS_OVERSCAN);

  useFrame(({ camera, clock }, delta) => {
    const target = baseZoom * zoomRef.current;
    const nextZoom = reducedMotion ? target : approach(camera.zoom, target, isFocused ? 0.00015 : 0.018, delta);
    if (Math.abs(camera.zoom - nextZoom) > 0.0001) {
      camera.zoom = nextZoom;
      camera.updateProjectionMatrix();
    }

    if (isPointerOver) return;

    const drift = reducedMotion || isFocused ? 0 : 1;
    camera.position.x = approach(camera.position.x, Math.sin(clock.elapsedTime * 0.19) * 0.055 * drift, 0.04, delta);
    camera.position.y = approach(camera.position.y, Math.sin(clock.elapsedTime * 0.13 + 1.2) * 0.038 * drift, 0.04, delta);
  });

  return <OrthographicCamera makeDefault position={[0, 0, 14]} zoom={baseZoom} near={0.1} far={60} />;
}

/**
 * A wheel riding the mater's ring gear. Its angle is derived from the ring's, so it can
 * only turn when the mechanism turns — no free-running timer.
 */
function TrainWheel({
  seat,
  transmissionRef,
  assemblyRef,
  order,
}: {
  seat: number;
  transmissionRef: MutableRefObject<Transmission>;
  assemblyRef: MutableRefObject<number>;
  order: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const kit = useGeometryKit(() => ({
    body: discGeometry(0.23, 0.22, 32),
    teeth: radialMerge(new THREE.BoxGeometry(0.13, 0.11, 0.22), WHEEL_TEETH, WHEEL_PITCH_RADIUS),
    collar: bandGeometry(0.1, 0.17, 0.28, 24),
    hub: new THREE.SphereGeometry(0.08, 16, 16),
  }));

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = wheelAngle(transmissionRef.current.ring, seat);
    const entry = easeBack(stage(assemblyRef.current, 0.3 + order * 0.05, 0.62 + order * 0.05));
    groupRef.current.scale.setScalar(Math.max(0.001, entry));
  });

  return (
    <group position={[Math.cos(seat) * WHEEL_ORBIT_RADIUS, Math.sin(seat) * WHEEL_ORBIT_RADIUS, TRAIN_PLANE_Z]}>
      <group ref={groupRef}>
        <ToonPart geometry={kit.teeth} color={palette.brassPale} outline={0.022} />
        <ToonPart geometry={kit.body} color={palette.engrave} outline={0.024} />
        <ToonPart geometry={kit.collar} color={palette.brassLight} outline={0.02} />
        <FlatPart geometry={kit.hub} color={palette.jewel} outline={0.02} position={[0, 0, 0.16]} />
      </group>
    </group>
  );
}

/**
 * Escape wheel and pallet. The fork rocks once per tooth of actual rotation, so the beat
 * is a consequence of the train turning rather than a loop running beside it.
 */
function Escapement({
  transmissionRef,
  assemblyRef,
}: {
  transmissionRef: MutableRefObject<Transmission>;
  assemblyRef: MutableRefObject<number>;
}) {
  const wheelRef = useRef<THREE.Group>(null);
  const palletRef = useRef<THREE.Group>(null);
  const mountRef = useRef<THREE.Group>(null);
  const kit = useGeometryKit(() => ({
    body: discGeometry(0.19, 0.18, 32),
    teeth: radialMerge(new THREE.BoxGeometry(0.13, 0.08, 0.18), WHEEL_TEETH, WHEEL_PITCH_RADIUS),
    rim: bandGeometry(0.09, 0.15, 0.24, 24),
    fork: new THREE.BoxGeometry(0.5, 0.09, 0.13),
    pallet: new THREE.BoxGeometry(0.1, 0.22, 0.15),
    arbor: new THREE.SphereGeometry(0.08, 14, 14),
  }));

  useFrame(() => {
    const angle = wheelAngle(transmissionRef.current.ring, ESCAPEMENT_SEAT);
    if (wheelRef.current) wheelRef.current.rotation.z = angle;
    if (palletRef.current) palletRef.current.rotation.z = Math.sin(angle * WHEEL_TEETH) * 0.26;
    if (mountRef.current) {
      const entry = easeBack(stage(assemblyRef.current, 0.5, 0.82));
      mountRef.current.scale.setScalar(Math.max(0.001, entry));
    }
  });

  return (
    <group
      ref={mountRef}
      position={[Math.cos(ESCAPEMENT_SEAT) * WHEEL_ORBIT_RADIUS, Math.sin(ESCAPEMENT_SEAT) * WHEEL_ORBIT_RADIUS, TRAIN_PLANE_Z]}
    >
      <group ref={wheelRef}>
        <ToonPart geometry={kit.teeth} color={palette.brassPale} outline={0.02} />
        <ToonPart geometry={kit.body} color={palette.brassDeep} outline={0.022} />
        <ToonPart geometry={kit.rim} color={palette.brassLight} outline={0.018} />
      </group>
      <group ref={palletRef} position={[0, 0.35, 0.14]}>
        <ToonPart geometry={kit.fork} color={palette.brassDeep} outline={0.022} />
        <ToonPart geometry={kit.pallet} color={palette.brassLight} outline={0.02} position={[-0.23, -0.1, 0]} />
        <ToonPart geometry={kit.pallet} color={palette.brassLight} outline={0.02} position={[0.23, -0.1, 0]} />
        <FlatPart geometry={kit.arbor} color={palette.jewel} outline={0.018} position={[0, 0, 0.12]} />
      </group>
    </group>
  );
}

/**
 * One ring of the armillary cage. These sit on real astronomical planes — equator,
 * colure, ecliptic — rather than arbitrary tilts, and they are fixed to the cage instead
 * of each spinning on its own axis. Rings that stay put read as an instrument; rings
 * turning independently read as clutter crossing the map.
 */
function CageRing({
  rotation,
  assemblyRef,
  transmissionRef,
  orbitRate,
  orbitAxis,
  order,
  isReading,
  radius = 2.88,
  color = palette.brass,
  marked = false,
}: {
  rotation: [number, number, number];
  assemblyRef: MutableRefObject<number>;
  transmissionRef: MutableRefObject<Transmission>;
  orbitRate: number;
  orbitAxis: "x" | "y" | "z";
  order: number;
  isReading: boolean;
  radius?: number;
  color?: string;
  /** The ecliptic carries the twelve signs, so they leave the globe's face clear. */
  marked?: boolean;
}) {
  const gimbalRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const idlerRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);
  const previousOrbitRef = useRef(0);
  const kit = useGeometryKit(() => ({
    band: bandGeometry(radius - 0.06, radius + 0.06, 0.14),
    edge: bandGeometry(radius - 0.08, radius - 0.06, 0.18),
    marks: radialMerge(new THREE.OctahedronGeometry(0.075, 0), 12, radius),
    boss: discGeometry(0.12, 0.24, 20),
    bead: new THREE.SphereGeometry(0.1, 14, 12),
    idler: discGeometry(0.1, 0.14, 20),
    idlerTeeth: radialMerge(new THREE.BoxGeometry(0.07, 0.045, 0.14), 8, 0.14),
  }));

  useFrame((_, delta) => {
    if (!ringRef.current) return;
    const entry = easeOut(stage(assemblyRef.current, 0.42 + order * 0.07, 0.78 + order * 0.07));
    ringRef.current.scale.setScalar(Math.max(0.001, entry));

    // When a chapter opens, the transverse rings mechanically align with the
    // celestial plate. This leaves a clear reading aperture without making the
    // instrument disappear or placing a UI panel over it.
    const alignmentDamping = 1 - Math.pow(0.001, Math.min(delta, 0.05));
    ringRef.current.rotation.x = settle(ringRef.current.rotation.x, isReading ? 0 : rotation[0], alignmentDamping);
    ringRef.current.rotation.z = transmissionRef.current.ring * orbitRate * 0.08 + rotation[2];

    let orbitDelta = transmissionRef.current.orbitPhase - previousOrbitRef.current;
    if (orbitDelta > Math.PI) orbitDelta -= Math.PI * 2;
    if (orbitDelta < -Math.PI) orbitDelta += Math.PI * 2;
    previousOrbitRef.current = transmissionRef.current.orbitPhase;
    phaseRef.current += orbitDelta * orbitRate * (isReading ? 0.22 : 1);

    if (gimbalRef.current) gimbalRef.current.rotation[orbitAxis] = phaseRef.current;
    if (idlerRef.current) idlerRef.current.rotation.z = wheelAngle(phaseRef.current, 0);
  });

  return (
    <group ref={gimbalRef}>
      <group ref={ringRef} rotation={rotation}>
        <ToonPart geometry={kit.band} color={color} outline={0.024} />
        <ToonPart geometry={kit.edge} color={palette.brassPale} outline={0.016} />
        {marked && <ToonPart geometry={kit.marks} color={palette.brassPale} outline={0.018} />}
        <ToonPart geometry={kit.boss} color={palette.brassLight} outline={0.022} position={[0, radius, 0]} />
        <ToonPart geometry={kit.boss} color={palette.brassLight} outline={0.022} position={[0, -radius, 0]} />
        <FlatPart geometry={kit.bead} color={palette.jewel} outline={0.018} position={[radius, 0, 0.11]} />
        <group ref={idlerRef} position={[0, radius, 0.14]}>
          <ToonPart geometry={kit.idlerTeeth} color={palette.brassPale} outline={0.016} />
          <ToonPart geometry={kit.idler} color={palette.brassDeep} outline={0.018} />
        </group>
      </group>
    </group>
  );
}

/** A dedicated runner orbit just outside the globe. The carrier and idler are driven by
 * the same transmission phase, but their ratio is slower than the cage so the movement
 * reads as a separate mechanism rather than another ring sliding with the case. */
function GlobeOrbitRing({
  transmissionRef,
  assemblyRef,
  reducedMotion,
  isReading,
}: {
  transmissionRef: MutableRefObject<Transmission>;
  assemblyRef: MutableRefObject<number>;
  reducedMotion: boolean;
  isReading: boolean;
}) {
  const ringRef = useRef<THREE.Group>(null);
  const carrierRef = useRef<THREE.Group>(null);
  const idlerRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);
  const previousOrbitRef = useRef(0);
  const kit = useGeometryKit(() => ({
    rail: new THREE.TorusGeometry(GLOBE_RADIUS + 0.17, 0.018, 8, 128),
    railInset: new THREE.TorusGeometry(GLOBE_RADIUS + 0.25, 0.008, 6, 128),
    carrier: new THREE.SphereGeometry(0.105, 14, 10),
    carrierCap: new THREE.CylinderGeometry(0.07, 0.07, 0.045, 12),
    idler: discGeometry(0.12, 0.12, 20),
    idlerTeeth: radialMerge(new THREE.BoxGeometry(0.045, 0.032, 0.09), 10, 0.14),
  }));

  useFrame((_, delta) => {
    const entry = easeOut(stage(assemblyRef.current, 0.52, 0.82));
    const orbit = transmissionRef.current.orbitPhase;
    let orbitDelta = orbit - previousOrbitRef.current;
    if (orbitDelta > Math.PI) orbitDelta -= Math.PI * 2;
    if (orbitDelta < -Math.PI) orbitDelta += Math.PI * 2;
    previousOrbitRef.current = orbit;
    phaseRef.current += orbitDelta * (isReading ? 0.16 : 0.46);

    if (ringRef.current) {
      ringRef.current.scale.setScalar(Math.max(0.001, entry));
      ringRef.current.rotation.x = THREE.MathUtils.degToRad(18);
      ringRef.current.rotation.z = phaseRef.current;
    }
    if (carrierRef.current) {
      carrierRef.current.rotation.z = phaseRef.current * -1.4;
      carrierRef.current.rotation.x = Math.sin(phaseRef.current * 0.7) * THREE.MathUtils.degToRad(4);
    }
    if (idlerRef.current) idlerRef.current.rotation.z = wheelAngle(phaseRef.current * 0.46, 0);
    if (reducedMotion && ringRef.current) ringRef.current.rotation.z = 0;
    void delta;
  });

  return (
    <group ref={ringRef} position={[0, 0, 0.06]}>
      <FlatPart geometry={kit.rail} color={palette.brassPale} opacity={0.68} />
      <FlatPart geometry={kit.railInset} color={palette.amethystLight} opacity={0.34} />
      <group ref={carrierRef} position={[GLOBE_RADIUS + 0.17, 0, 0.16]}>
        <FlatPart geometry={kit.carrier} color={palette.starGold} outline={0.018} />
        <FlatPart geometry={kit.carrierCap} color={palette.jewel} outline={0.014} position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]} />
        <group ref={idlerRef} position={[0.16, 0, 0.02]}>
          <ToonPart geometry={kit.idlerTeeth} color={palette.brassLight} outline={0.012} />
          <ToonPart geometry={kit.idler} color={palette.brassDeep} outline={0.014} />
        </group>
      </group>
    </group>
  );
}

/**
 * Radial burst of golden particles when a star is selected — a brief celebratory flash
 * that rewards the interaction before the chapter panel opens.
 */
function SelectionBurst({
  position,
  active,
  reducedMotion,
}: {
  position: THREE.Vector3;
  active: boolean;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const phaseRef = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const wasActive = useRef(false);
  const count = 14;
  const directions = useMemo(() => {
    const dirs: THREE.Vector3[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = goldenAngle * i;
      dirs.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize());
    }
    return dirs;
  }, []);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.028, 6, 4), []);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    // Fire the burst on the rising edge of 'active'
    if (active && !wasActive.current) phaseRef.current = 0;
    wasActive.current = active;
    if (phaseRef.current < 0 || !meshRef.current || !materialRef.current) return;

    phaseRef.current += delta;
    const t = phaseRef.current;
    const duration = 0.85;
    if (t > duration) {
      phaseRef.current = -1;
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;
    const progress = t / duration;
    const ease = 1 - Math.pow(1 - progress, 2);
    materialRef.current.opacity = 1 - progress;

    for (let i = 0; i < count; i++) {
      const spread = ease * 0.65;
      dummy.position.copy(position).addScaledVector(directions[i], spread);
      dummy.scale.setScalar(Math.max(0.001, (1 - progress) * (0.6 + Math.sin(i * 2.3) * 0.3)));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} visible={false}>
      <meshBasicMaterial ref={materialRef} color={palette.starGold} transparent depthWrite={false} />
    </instancedMesh>
  );
}

/**
 * Atmospheric limb glow around the globe that intensifies when a star is focused,
 * giving the feeling of the globe "powering up".
 */
function GlobeAtmosphere({
  isFocused,
  reducedMotion,
}: {
  isFocused: boolean;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const intensityRef = useRef(0);

  const geometry = useMemo(() => {
    // A slightly larger sphere used as an additive glow shell
    return new THREE.SphereGeometry(GLOBE_RADIUS + 0.08, 48, 32);
  }, []);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || !materialRef.current) return;
    const target = isFocused ? 0.28 : 0.06;
    intensityRef.current = reducedMotion ? target : approach(intensityRef.current, target, 0.05, delta);
    const breath = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.8) * 0.02;
    materialRef.current.opacity = intensityRef.current + breath;
    meshRef.current.scale.setScalar(1 + breath * 0.5);
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        ref={materialRef}
        color="#a06cd5"
        transparent
        opacity={0.06}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

function StarPin({
  star,
  selected,
  hovered,
  assemblyRef,
  spotlight,
  reducedMotion,
  onOpen,
  onHover,
}: {
  star: ClockStar;
  selected: boolean;
  hovered: boolean;
  assemblyRef: MutableRefObject<number>;
  spotlight: ConstellationId | null;
  reducedMotion: boolean;
  onOpen: (star: ClockStar) => void;
  onHover: (id: AstrolabeSection | null) => void;
}) {
  const anchorRef = useRef<THREE.Group>(null);
  const reticleRef = useRef<THREE.Group>(null);
  const scanRingRef = useRef<THREE.Mesh>(null);
  const scanMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const confirmPulseRef = useRef<THREE.Mesh>(null);
  const confirmMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const beaconMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const beaconPingRef = useRef<THREE.Mesh>(null);
  const beaconPingMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const labelRef = useRef<HTMLButtonElement>(null);
  const mapLevelRef = useRef(0);
  const lockPhaseRef = useRef(0);
  const wasSelectedRef = useRef(false);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => starPosition(star, GLOBE_RADIUS + 0.05), [star]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize()),
    [position],
  );
  const size = 0.1 * star.size;
  const constellation = constellationIdForStar(star);
  const kit = useGeometryKit(() => ({
    stem: new THREE.CylinderGeometry(0.035, 0.055, 0.14, 10),
    socket: discGeometry(0.17, 0.1, 24),
    collar: bandGeometry(0.17, 0.23, 0.06, 24),
    core: new THREE.OctahedronGeometry(1, 0),
    reticle: new THREE.TorusGeometry(0.3, 0.016, 6, 32),
    reticleOuter: new THREE.TorusGeometry(0.46, 0.012, 6, 32),
    beacon: new THREE.TorusGeometry(0.34, 0.014, 6, 36),
    // Second concentric beacon ring — the "radar ping" that expands outward
    beaconPing: new THREE.TorusGeometry(0.34, 0.01, 6, 36),
    // Scan ring: a wider, thinner ring used during the acquisition phase
    scanRing: new THREE.TorusGeometry(0.62, 0.009, 6, 40),
    // Confirmation pulse: a disc that flashes on lock
    confirmPulse: new THREE.CircleGeometry(0.38, 24),
    reticleTick: radialMerge(new THREE.BoxGeometry(0.1, 0.022, 0.022), 4, 0.4),
    targetCross: radialMerge(new THREE.BoxGeometry(0.14, 0.018, 0.018), 4, 0.54),
  }));

  useFrame(({ clock }, delta) => {
    const active = hovered || selected;
    const targetMapLevel = constellationTargetLevel(constellation, clock.elapsedTime, spotlight, reducedMotion);
    mapLevelRef.current = reducedMotion
      ? targetMapLevel
      : approach(mapLevelRef.current, targetMapLevel, 0.035, delta);
    if (anchorRef.current) anchorRef.current.scale.setScalar(Math.max(0.001, mapLevelRef.current));

    // Label facing/opacity
    if (anchorRef.current && labelRef.current) {
      anchorRef.current.getWorldPosition(worldPosition);
      const facing = worldPosition.z / (worldPosition.length() || 1);
      const presence = THREE.MathUtils.clamp((facing + 0.08) / 0.35, 0, 1)
        * stage(assemblyRef.current, 0.85, 1)
        * mapLevelRef.current;
      labelRef.current.style.opacity = presence.toFixed(3);
      labelRef.current.classList.toggle("is-flipped", worldPosition.x > 0);
      labelRef.current.dataset.faces = presence > 0.25 ? "1" : "0";
    }

    // ── Dual-ring beacon with radar ping ──
    if (beaconRef.current && beaconMaterialRef.current) {
      const idle = active ? 0 : 1;
      const breath = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 1.15 + star.ra) * 0.5 + 0.5;
      const presence = THREE.MathUtils.lerp(beaconMaterialRef.current.opacity, idle * (0.32 + breath * 0.42), 0.12);
      beaconMaterialRef.current.opacity = presence;
      beaconRef.current.visible = presence > 0.02;
      beaconRef.current.scale.setScalar(1 + breath * 0.12);
    }
    // Radar ping: a second ring that periodically expands and fades
    if (beaconPingRef.current && beaconPingMaterialRef.current && !reducedMotion) {
      const idle = active ? 0 : 1;
      const pingCycle = (clock.elapsedTime * 0.5 + star.ra * 0.3) % 1;
      const pingScale = 1 + pingCycle * 0.8;
      const pingOpacity = idle * Math.max(0, (1 - pingCycle) * 0.35);
      beaconPingMaterialRef.current.opacity = pingOpacity;
      beaconPingRef.current.scale.setScalar(pingScale);
      beaconPingRef.current.visible = pingOpacity > 0.01;
    }

    // ── Three-stage reticle acquisition ──
    if (selected && !wasSelectedRef.current) lockPhaseRef.current = 0;
    if (!selected) lockPhaseRef.current = 0;
    wasSelectedRef.current = selected;
    if (selected && !reducedMotion) lockPhaseRef.current = Math.min(1, lockPhaseRef.current + delta * 1.6);

    // Scan ring: rapidly spins and contracts to the target during phase 0–0.4
    if (scanRingRef.current && scanMaterialRef.current) {
      if (selected && lockPhaseRef.current < 0.5) {
        const scanProgress = lockPhaseRef.current / 0.5;
        scanRingRef.current.visible = true;
        scanRingRef.current.scale.setScalar(THREE.MathUtils.lerp(2.2, 0.8, easeOut(scanProgress)));
        scanRingRef.current.rotation.z += delta * 18;
        scanMaterialRef.current.opacity = THREE.MathUtils.lerp(0.7, 0, scanProgress);
      } else {
        scanRingRef.current.visible = false;
      }
    }

    // Confirmation pulse: a bright disc flash on lock at phase 0.45–0.7
    if (confirmPulseRef.current && confirmMaterialRef.current) {
      if (selected && lockPhaseRef.current > 0.4 && lockPhaseRef.current < 0.75) {
        const confirmProgress = (lockPhaseRef.current - 0.4) / 0.35;
        confirmPulseRef.current.visible = true;
        confirmPulseRef.current.scale.setScalar(THREE.MathUtils.lerp(0.3, 1.8, easeOut(confirmProgress)));
        confirmMaterialRef.current.opacity = Math.max(0, (1 - confirmProgress) * 0.55);
      } else {
        confirmPulseRef.current.visible = false;
      }
    }

    if (reticleRef.current) {
      const target = selected ? 1.35 : hovered ? 1 : 0.001;
      const speed = selected ? 0.22 : 0.16;
      const next = THREE.MathUtils.lerp(reticleRef.current.scale.x, target, speed);
      reticleRef.current.scale.setScalar(next);
      // When locked, the reticle settles to a slow dignified rotation instead of spinning
      const lockSpin = selected && lockPhaseRef.current > 0.6
        ? THREE.MathUtils.lerp(8, 1.2, Math.min(1, (lockPhaseRef.current - 0.6) / 0.4))
        : selected ? 8 : active ? 0.9 : 0;
      reticleRef.current.rotation.z += delta * lockSpin;
      reticleRef.current.visible = next > 0.01;
    }
  });

  return (
    <group ref={anchorRef} position={position} quaternion={quaternion}>
      <ToonPart geometry={kit.stem} color={palette.brass} outline={0.02} position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]} />
      <group scale={star.size}>
        <ToonPart geometry={kit.socket} color={palette.brassLight} outline={0.028} position={[0, 0, 0.16]} />
        <ToonPart geometry={kit.collar} color={palette.brassDeep} outline={0.024} position={[0, 0, 0.16]} />
      </group>
      <FlatPart geometry={kit.core} color={palette.starCore} outline={0.022} position={[0, 0, 0.23]} scale={size * 0.92} />

      {/* Primary beacon ring */}
      <mesh ref={beaconRef} geometry={kit.beacon} position={[0, 0, 0.24]}>
        <meshBasicMaterial ref={beaconMaterialRef} color={palette.starGold} transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Radar-ping second ring */}
      <mesh ref={beaconPingRef} geometry={kit.beaconPing} position={[0, 0, 0.24]} visible={false}>
        <meshBasicMaterial ref={beaconPingMaterialRef} color={palette.starGold} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Scan ring for acquisition phase */}
      <mesh ref={scanRingRef} geometry={kit.scanRing} position={[0, 0, 0.26]} visible={false}>
        <meshBasicMaterial ref={scanMaterialRef} color={palette.starCore} transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Confirmation flash pulse */}
      <mesh ref={confirmPulseRef} geometry={kit.confirmPulse} position={[0, 0, 0.24]} visible={false}>
        <meshBasicMaterial ref={confirmMaterialRef} color={palette.starGold} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <group ref={reticleRef} position={[0, 0, 0.25]} scale={0.001}>
        <FlatPart geometry={kit.reticle} color={palette.starGold} opacity={0.95} />
        <FlatPart geometry={kit.reticleTick} color={palette.starCore} opacity={0.9} />
        {selected && (
          <>
            <FlatPart geometry={kit.reticleOuter} color={palette.starGold} opacity={0.8} />
            <FlatPart geometry={kit.targetCross} color={palette.brassPale} opacity={0.85} />
          </>
        )}
      </group>

      <SelectionBurst position={position} active={selected} reducedMotion={reducedMotion} />

      <Html position={[0, 0, 0]} center sprite transform distanceFactor={7.5} zIndexRange={[70, 20]}>
        <button
          ref={labelRef}
          type="button"
          className={`orrery-star orrery-star-3d${hovered ? " is-hovered" : ""}${selected ? " is-selected" : ""}`}
          onClick={() => onOpen(star)}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={() => onHover(star.id)}
          onPointerLeave={() => onHover(null)}
          onFocus={() => onHover(star.id)}
          onBlur={() => onHover(null)}
          aria-label={`Open ${star.chapter} at ${star.name}`}
          aria-pressed={selected}
          data-cursor="star"
          data-cursor-label={star.chapter}
        >
          <span className="orrery-star-3d__flare" aria-hidden="true" />
          <span className="orrery-star__name">{star.name}</span>
          <span className="orrery-star__chapter">{star.chapter}</span>
        </button>
      </Html>
    </group>
  );
}

function CelestialDust({ reducedMotion }: { reducedMotion: boolean }) {
  const shellRef = useRef<THREE.Group>(null);
  const positions = useMemo(() => {
    const points = new Float32Array(220 * 3);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let index = 0; index < 220; index += 1) {
      const y = 1 - (index / 219) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = goldenAngle * index;
      points[index * 3] = Math.cos(angle) * radius * (GLOBE_RADIUS + 0.02);
      points[index * 3 + 1] = y * (GLOBE_RADIUS + 0.02);
      points[index * 3 + 2] = Math.sin(angle) * radius * (GLOBE_RADIUS + 0.02);
    }

    return points;
  }, []);

  useFrame((_, delta) => {
    if (!shellRef.current || reducedMotion) return;
    shellRef.current.rotation.y += delta * 0.018;
    shellRef.current.rotation.x += delta * 0.004;
  });

  return (
    <group ref={shellRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={palette.starCore} size={0.05} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
      </points>
    </group>
  );
}

function ConstellationFigure({
  constellation,
  color,
  opacity,
  reducedMotion,
  spotlight,
  hoveredStarKey,
}: {
  constellation: Constellation;
  color: string;
  opacity: number;
  reducedMotion: boolean;
  spotlight: "aries" | "pisces" | null;
  hoveredStarKey: string | null;
}) {
  const figureRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.InstancedMesh>(null);
  const coresRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.Mesh>(null);
  const lineMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const nodeMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const levelRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const radialQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const outward = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const figure = useMemo(() => {
    const byKey = new Map(constellation.stars.map((star) => [star.key, star]));
    const curves = constellation.segments.map(([fromKey, toKey]) => {
      const from = byKey.get(fromKey);
      const to = byKey.get(toKey);
      if (!from || !to) throw new Error(`Broken ${constellation.id} segment: ${fromKey} -> ${toKey}`);
      return buildConstellationArc(from, to, GLOBE_RADIUS + 0.05);
    });
    const line = mergeParts(curves.map((curve) => ({
      geometry: new THREE.TubeGeometry(curve, 28, constellation.id === "aries" ? 0.022 : 0.018, 6, false),
    })));

    return {
      curves,
      line,
      node: new THREE.OctahedronGeometry(1, 0),
      core: new THREE.SphereGeometry(1, 10, 8),
      spark: new THREE.SphereGeometry(0.045, 10, 8),
    };
  }, [constellation]);

  useEffect(() => () => {
    figure.line.dispose();
    figure.node.dispose();
    figure.core.dispose();
    figure.spark.dispose();
  }, [figure]);

  // Track which segments connect to the hovered star for glow-through
  const hoveredSegmentIndices = useMemo(() => {
    if (!hoveredStarKey) return new Set<number>();
    const indices = new Set<number>();
    constellation.segments.forEach(([fromKey, toKey], index) => {
      if (fromKey === hoveredStarKey || toKey === hoveredStarKey) indices.add(index);
    });
    return indices;
  }, [hoveredStarKey, constellation.segments]);

  // Glow tube for hovered segments
  const glowLine = useMemo(() => {
    if (hoveredSegmentIndices.size === 0) return null;
    const byKey = new Map(constellation.stars.map((s) => [s.key, s]));
    const glowCurves = constellation.segments
      .filter((_, index) => hoveredSegmentIndices.has(index))
      .map(([fromKey, toKey]) => {
        const from = byKey.get(fromKey);
        const to = byKey.get(toKey);
        if (!from || !to) return null;
        return new THREE.TubeGeometry(
          buildConstellationArc(from, to, GLOBE_RADIUS + 0.05),
          28, 0.04, 8, false
        );
      })
      .filter(Boolean) as THREE.TubeGeometry[];
    if (glowCurves.length === 0) return null;
    return mergeParts(glowCurves.map((g) => ({ geometry: g })));
  }, [hoveredSegmentIndices, constellation]);

  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime;
    const targetLevel = constellationTargetLevel(constellation.id, time, spotlight, reducedMotion);
    levelRef.current = reducedMotion ? targetLevel : approach(levelRef.current, targetLevel, 0.035, delta);
    const currentLevel = THREE.MathUtils.clamp(levelRef.current, 0, 1);
    if (figureRef.current) {
      figureRef.current.visible = currentLevel > 0.008;
      figureRef.current.scale.setScalar(THREE.MathUtils.lerp(0.94, 1, currentLevel));
    }
    // Base line opacity dims slightly when a star is hovered (to make glow lines pop)
    const baseDim = hoveredStarKey ? 0.55 : 1;
    if (lineMaterialRef.current) lineMaterialRef.current.opacity = opacity * currentLevel * baseDim;
    if (nodeMaterialRef.current) nodeMaterialRef.current.opacity = currentLevel;
    if (coreMaterialRef.current) coreMaterialRef.current.opacity = currentLevel;

    // Glow lines pulse
    if (glowMaterialRef.current) {
      const pulse = reducedMotion ? 0.9 : 0.75 + Math.sin(time * 3.2) * 0.15;
      glowMaterialRef.current.opacity = currentLevel * pulse;
    }

    constellation.stars.forEach((star, index) => {
      const starPos = starPosition(star, GLOBE_RADIUS + 0.065);
      const magnitudeScale = THREE.MathUtils.clamp(0.13 - star.magnitude * 0.014, 0.052, 0.096);
      const mapScale = constellation.id === "pisces" ? 1.28 : 1;
      // Stars connected to the hovered star brighten
      const isConnected = hoveredStarKey === star.key;
      const brightBoost = isConnected ? 1.35 : 1;
      const twinkle = reducedMotion ? 1 : 1 + Math.sin(time * 1.4 + index * 1.73) * 0.075;
      radialQuaternion.setFromUnitVectors(outward, starPos.clone().normalize());

      dummy.position.copy(starPos);
      dummy.quaternion.copy(radialQuaternion);
      dummy.scale.setScalar(magnitudeScale * mapScale * twinkle * brightBoost * THREE.MathUtils.lerp(0.76, 1, currentLevel));
      dummy.updateMatrix();
      nodesRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.scale.setScalar(magnitudeScale * mapScale * 0.46 * twinkle * brightBoost * THREE.MathUtils.lerp(0.76, 1, currentLevel));
      dummy.updateMatrix();
      coresRef.current?.setMatrixAt(index, dummy.matrix);
    });

    if (nodesRef.current) nodesRef.current.instanceMatrix.needsUpdate = true;
    if (coresRef.current) coresRef.current.instanceMatrix.needsUpdate = true;

    if (sparkRef.current) {
      if (reducedMotion) {
        sparkRef.current.visible = false;
      } else {
        const cycleLength = 7.5;
        const travelDuration = 2.2;
        const cycle = (time + (constellation.id === "pisces" ? 3.4 : 0)) % cycleLength;
        const segmentIndex = Math.floor((time + (constellation.id === "pisces" ? 11 : 0)) / cycleLength) % figure.curves.length;
        sparkRef.current.visible = cycle < travelDuration && currentLevel > 0.46;
        if (sparkRef.current.visible) sparkRef.current.position.copy(figure.curves[segmentIndex].getPoint(cycle / travelDuration));
      }
    }
  });

  return (
    <group ref={figureRef}>
      <mesh geometry={figure.line}>
        <meshBasicMaterial ref={lineMaterialRef} color={color} transparent opacity={opacity} />
      </mesh>
      {/* Glow-through: brighter, thicker lines on segments connected to hovered star */}
      {glowLine && (
        <mesh geometry={glowLine}>
          <meshBasicMaterial ref={glowMaterialRef} color={palette.starGold} transparent opacity={0.8} depthWrite={false} />
        </mesh>
      )}
      <instancedMesh ref={nodesRef} args={[figure.node, undefined, constellation.stars.length]}>
        <meshBasicMaterial ref={nodeMaterialRef} color={palette.brassLight} transparent />
      </instancedMesh>
      <instancedMesh ref={coresRef} args={[figure.core, undefined, constellation.stars.length]}>
        <meshBasicMaterial ref={coreMaterialRef} color={palette.starCore} transparent />
      </instancedMesh>
      <mesh ref={sparkRef} geometry={figure.spark} visible={false}>
        <meshBasicMaterial color={palette.starGold} />
      </mesh>
    </group>
  );
}

/** The celestial sphere: hard terminator, drawn graticule, engraved constellation. */
function Globe({
  stars,
  selectedId,
  hoveredId,
  activeConstellation,
  assemblyRef,
  reducedMotion,
  onOpenStar,
  onHoverStar,
}: {
  stars: ClockStar[];
  selectedId: AstrolabeSection | null;
  hoveredId: AstrolabeSection | null;
  activeConstellation: ConstellationId;
  assemblyRef: MutableRefObject<number>;
  reducedMotion: boolean;
  onOpenStar: (star: ClockStar) => void;
  onHoverStar: (id: AstrolabeSection | null) => void;
}) {
  const piscesIds: Set<AstrolabeSection> = new Set(["pisces", "experience"]);
  const spotlight = piscesIds.has(selectedId!) || piscesIds.has(hoveredId!)
    ? "pisces"
    : selectedId || hoveredId
      ? "aries"
      : activeConstellation;
  const kit = useGeometryKit(() => ({
    body: new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48),
    // Graticule baked into two meshes rather than eleven — same drawing, a tenth the calls.
    graticuleGold: mergeParts([
      { geometry: new THREE.TorusGeometry(GLOBE_RADIUS, 0.022, 6, 96), rotation: [Math.PI / 2, 0, 0] },
      { geometry: new THREE.TorusGeometry(GLOBE_RADIUS * 0.86, 0.011, 6, 80), rotation: [Math.PI / 2, 0, 0], position: [0, GLOBE_RADIUS * 0.5, 0] },
      { geometry: new THREE.TorusGeometry(GLOBE_RADIUS * 0.86, 0.011, 6, 80), rotation: [Math.PI / 2, 0, 0], position: [0, -GLOBE_RADIUS * 0.5, 0] },
    ]),
    graticuleViolet: mergeParts([
      { geometry: new THREE.TorusGeometry(GLOBE_RADIUS * 0.55, 0.009, 6, 64), rotation: [Math.PI / 2, 0, 0], position: [0, GLOBE_RADIUS * 0.83, 0] },
      { geometry: new THREE.TorusGeometry(GLOBE_RADIUS * 0.55, 0.009, 6, 64), rotation: [Math.PI / 2, 0, 0], position: [0, -GLOBE_RADIUS * 0.83, 0] },
      ...[0, 30, 60, 90, 120, 150].map((degrees) => ({
        geometry: new THREE.TorusGeometry(GLOBE_RADIUS, 0.011, 6, 96),
        rotation: [0, THREE.MathUtils.degToRad(degrees), 0] as [number, number, number],
      })),
    ]),
  }));

  const hoveredStar = stars.find((s) => s.id === hoveredId);
  const hoveredStarKey = hoveredStar?.key ?? null;

  return (
    <group>
      <FlatPart geometry={kit.body} color={palette.void} outline={0.03} />

      <GlobeAtmosphere isFocused={Boolean(selectedId)} reducedMotion={reducedMotion} />

      {/* The ecliptic and its twelve signs now live on the cage ring, off the map's face. */}
      <FlatPart geometry={kit.graticuleGold} color={palette.brassPale} opacity={0.7} />
      <FlatPart geometry={kit.graticuleViolet} color={palette.amethystLight} opacity={0.26} />

      <CelestialDust reducedMotion={reducedMotion} />

      <ConstellationFigure constellation={piscesConstellation} color={palette.amethystLight} opacity={0.72} reducedMotion={reducedMotion} spotlight={spotlight} hoveredStarKey={hoveredStarKey} />
      <ConstellationFigure constellation={ariesConstellation} color={palette.starCore} opacity={0.95} reducedMotion={reducedMotion} spotlight={spotlight} hoveredStarKey={hoveredStarKey} />

      {stars.map((star) => (
        <StarPin
          key={star.id}
          star={star}
          selected={star.id === selectedId}
          hovered={star.id === hoveredId}
          assemblyRef={assemblyRef}
          spotlight={spotlight}
          reducedMotion={reducedMotion}
          onOpen={onOpenStar}
          onHover={onHoverStar}
        />
      ))}
    </group>
  );
}

/** The brass case: open ring, engraved limb, ring gear, toothed rim, jewelled bearings. */
function Case({
  transmissionRef,
  assemblyRef,
}: {
  transmissionRef: MutableRefObject<Transmission>;
  assemblyRef: MutableRefObject<number>;
}) {
  const limbRef = useRef<THREE.Group>(null);
  const hourRingRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Group>(null);
  // Box args run (radial, tangential, depth) once radialMerge has spun them into place.
  // Static parts are baked together by colour — one fill and one contour per material.
  const kit = useGeometryKit(() => {
    const bearingSeats: Array<[number, number, number]> = [
      [0, 3.66, 0],
      [3.66, 0, 0],
      [-3.66, 0, 0],
    ];

    return {
      // Four blocks, four depth lanes: rear housing, case, index face, drive gear.
      shell: bandGeometry(3.4, 4.16, 0.28),
      brass: bandGeometry(3.45, 4.0, 0.32),
      brassLight: mergeParts([
        { geometry: bandGeometry(3.28, 3.4, 0.18), position: [0, 0, 0.08] },
        { geometry: bandGeometry(4.04, 4.13, 0.18), position: [0, 0, 0.08] },
        ...bearingSeats.map((position) => ({ geometry: discGeometry(0.2, 0.2, 20), position: [position[0], position[1], 0.14] as [number, number, number] })),
      ]),
      brassDeep: mergeParts([
        { geometry: bandGeometry(3.38, 3.43, 0.12), position: [0, 0, -0.34] },
        { geometry: radialMerge(new THREE.BoxGeometry(0.62, 0.1, 0.1), 6, 3.7), position: [0, 0, -0.34] },
      ]),
      brassPale: radialMerge(new THREE.CylinderGeometry(0.052, 0.052, 0.18, 10).rotateX(Math.PI / 2), 16, 4.08, { z: 0.2 }),
      jewels: mergeParts(
        bearingSeats.map(([x, y]) => ({ geometry: new THREE.SphereGeometry(0.11, 16, 16), position: [x, y, 0.27] as [number, number, number] })),
      ),
      indexTrack: bandGeometry(3.61, 3.66, 0.08),
      minorTicks: radialMerge(new THREE.BoxGeometry(0.12, 0.028, 0.07), 60, 3.84, { startAngle: THREE.MathUtils.degToRad(3) }),
      majorTicks: radialMerge(new THREE.BoxGeometry(0.28, 0.052, 0.09), 12, 3.78),
      gearTeeth: radialMerge(new THREE.BoxGeometry(0.14, 0.12, 0.2), RING_TEETH, RING_PITCH_RADIUS, { z: TRAIN_PLANE_Z }),
      gearBand: bandGeometry(RING_PITCH_RADIUS - 0.24, RING_PITCH_RADIUS - 0.02, 0.2),
      hourBand: bandGeometry(4.22, 4.3, 0.1),
      hourMarks: radialMerge(new THREE.BoxGeometry(0.16, 0.035, 0.08), 24, 4.26),
    };
  });

  useFrame(() => {
    if (limbRef.current) limbRef.current.rotation.z = transmissionRef.current.ring;
    if (hourRingRef.current) hourRingRef.current.rotation.z = transmissionRef.current.orbitPhase * ORBIT_RATES.hour;
    if (shellRef.current) {
      const entry = stage(assemblyRef.current, 0, 0.42);
      shellRef.current.scale.setScalar(THREE.MathUtils.lerp(0.86, 1, easeOut(entry)));
      shellRef.current.position.z = THREE.MathUtils.lerp(-2.6, 0, easeOut(entry));
    }
  });

  return (
    <group ref={shellRef}>
      <ToonPart geometry={kit.shell} color={palette.caseBack} outline={0.028} position={[0, 0, -0.46]} />
      <ToonPart geometry={kit.brass} color={palette.brass} outline={0.03} position={[0, 0, -0.16]} />
      <ToonPart geometry={kit.brassDeep} color={palette.brassDeep} outline={0.022} />
      <ToonPart geometry={kit.brassLight} color={palette.brassLight} outline={0.022} />
      <ToonPart geometry={kit.brassPale} color={palette.brassPale} outline={0.018} />
      <FlatPart geometry={kit.jewels} color={palette.jewel} outline={0.02} />

      <group ref={hourRingRef} position={[0, 0, -0.02]}>
        <ToonPart geometry={kit.hourBand} color={palette.brassDeep} outline={0.018} />
        <FlatPart geometry={kit.hourMarks} color={palette.brassPale} />
      </group>

      {/* The limb and the ring gear are one turning member — the train's driving wheel. */}
      <group ref={limbRef}>
        <FlatPart geometry={kit.indexTrack} color={palette.engrave} position={[0, 0, 0.19]} />
        <FlatPart geometry={kit.minorTicks} color={palette.brass} position={[0, 0, 0.22]} />
        <FlatPart geometry={kit.majorTicks} color={palette.brassPale} outline={0.012} position={[0, 0, 0.24]} />
        <ToonPart geometry={kit.gearBand} color={palette.brassDeep} outline={0.018} position={[0, 0, TRAIN_PLANE_Z + 0.04]} />
        <ToonPart geometry={kit.gearTeeth} color={palette.brassPale} outline={0.014} />
      </group>
    </group>
  );
}

/**
 * The sighting rule. Left alone it drifts with the going train; the moment a star is
 * hovered or open it swings round and holds on it, so the instrument reads as pointing
 * at what you are looking at.
 */
function Alidade({
  transmissionRef,
  aimRef,
  assemblyRef,
}: {
  transmissionRef: MutableRefObject<Transmission>;
  aimRef: MutableRefObject<number | null>;
  assemblyRef: MutableRefObject<number>;
}) {
  const ruleRef = useRef<THREE.Group>(null);
  const mountRef = useRef<THREE.Group>(null);
  // An index arm confined to the dial: it spans the mater only, so it never crosses the
  // sphere. The old full-diameter rule cut straight over the map and its stars.
  const kit = useGeometryKit(() => ({
    tip: new THREE.ConeGeometry(0.2, 0.46, 4).rotateZ(-Math.PI / 2),
    tail: new THREE.BoxGeometry(0.26, 0.34, 0.17),
    vane: new THREE.BoxGeometry(0.12, 0.44, 0.17),
    boss: discGeometry(0.17, 0.22, 24),
    pin: new THREE.SphereGeometry(0.09, 16, 16),
  }));

  useFrame((_, delta) => {
    if (mountRef.current) {
      const entry = easeOut(stage(assemblyRef.current, 0.68, 0.95));
      mountRef.current.scale.setScalar(Math.max(0.001, entry));
    }
    if (!ruleRef.current) return;
    const aim = aimRef.current;
    const target = aim ?? transmissionRef.current.ring * 2.4 + THREE.MathUtils.degToRad(-32);
    const damping = aim === null ? 1 - Math.pow(0.5, delta) : 1 - Math.pow(0.0001, delta);
    ruleRef.current.rotation.z = settleAngle(ruleRef.current.rotation.z, target, damping);
  });

  // Rides high enough to clear the gear train's front face, and its pivot end starts
  // beyond the cage rings' outer reach — at r 3.02 the tail and boss cut through them.
  return (
    <group ref={mountRef} position={[0, 0, 0.92]}>
      <group ref={ruleRef}>
        <ToonPart geometry={kit.tip} color={palette.brassPale} outline={0.024} position={[4.02, 0, 0]} />
        <ToonPart geometry={kit.tail} color={palette.brassLight} outline={0.024} position={[3.45, 0, 0]} />
        <ToonPart geometry={kit.vane} color={palette.brass} outline={0.022} position={[3.72, 0.16, 0]} />
        <ToonPart geometry={kit.boss} color={palette.brassLight} outline={0.024} position={[3.45, 0, 0.04]} />
        <FlatPart geometry={kit.pin} color={palette.jewel} outline={0.02} position={[3.45, 0, 0.18]} />
      </group>
    </group>
  );
}

/** The polar axle the globe actually turns on, journaled into collars on the mount. */
function PolarAxle() {
  const kit = useGeometryKit(() => ({
    shaft: new THREE.CylinderGeometry(0.05, 0.05, GLOBE_RADIUS * 2 + 1.1, 12),
    collar: bandGeometry(0.11, 0.2, 0.16, 20),
    cap: new THREE.SphereGeometry(0.11, 16, 16),
  }));

  return (
    <group>
      <ToonPart geometry={kit.shaft} color={palette.brassLight} outline={0.024} />
      <ToonPart geometry={kit.collar} color={palette.brassDeep} outline={0.022} position={[0, GLOBE_RADIUS + 0.32, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <ToonPart geometry={kit.collar} color={palette.brassDeep} outline={0.022} position={[0, -GLOBE_RADIUS - 0.32, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <FlatPart geometry={kit.cap} color={palette.jewel} outline={0.022} position={[0, GLOBE_RADIUS + 0.55, 0]} />
      <FlatPart geometry={kit.cap} color={palette.jewel} outline={0.022} position={[0, -GLOBE_RADIUS - 0.55, 0]} />
    </group>
  );
}

function ClockModel({
  stars,
  selectedId,
  hoveredId,
  orientationRef,
  globeRotationRef,
  driveRotationRef,
  reducedMotion,
  isRevealed,
  isReading,
  isPointerOver,
  activeConstellation,
  onOpenStar,
  onHoverStar,
}: Pick<
  CelestialClock3DProps,
  | "stars"
  | "selectedId"
  | "hoveredId"
  | "orientationRef"
  | "globeRotationRef"
  | "driveRotationRef"
  | "reducedMotion"
  | "isRevealed"
  | "isReading"
  | "isPointerOver"
  | "activeConstellation"
  | "onOpenStar"
  | "onHoverStar"
>) {
  const clockRef = useRef<THREE.Group>(null);
  const cageRef = useRef<THREE.Group>(null);
  const globeMountRef = useRef<THREE.Group>(null);
  const globeSpinRef = useRef<THREE.Group>(null);
  const aimRef = useRef<number | null>(null);
  const aimVector = useMemo(() => new THREE.Vector3(), []);
  const transmissionRef = useRef(createTransmission());
  const assemblyRef = useRef(0);
  const swingRef = useRef({ angle: REST_ROLL, velocity: 0 });
  const previousOrientation = useRef({ x: 42, y: 0 });
  const globePhaseRef = useRef(0);
  const previousOrbitPhaseRef = useRef(0);
  const precessionRef = useRef(0);
  const breathRef = useRef(1);
  const selectedStar = stars.find((star) => star.id === selectedId) ?? null;
  const aimedStar = stars.find((star) => star.id === (hoveredId ?? selectedId)) ?? null;

  useFrame(({ clock }, delta) => {
    // Floored: the first frame reports delta 0, and a zero step turns the pendulum's
    // rate calculation into 0/0, which would poison every world matrix downstream.
    const step = THREE.MathUtils.clamp(delta, 0.0001, 0.05);
    const orientation = orientationRef.current;
    const damping = reducedMotion || isPointerOver ? 1 : 1 - Math.pow(0.0008, step);

    // Assembly runs on wall clock, not the physics step, so a slow device does not
    // stretch the sequence out.
    assemblyRef.current = reducedMotion
      ? Number(isRevealed)
      : isRevealed
        ? Math.min(1, assemblyRef.current + Math.min(delta, 0.25) / 2.1)
        : 0;

    advanceTransmission(transmissionRef.current, driveRotationRef.current, step);
    let globePhaseDelta = transmissionRef.current.orbitPhase - previousOrbitPhaseRef.current;
    if (globePhaseDelta > Math.PI) globePhaseDelta -= Math.PI * 2;
    if (globePhaseDelta < -Math.PI) globePhaseDelta += Math.PI * 2;
    previousOrbitPhaseRef.current = transmissionRef.current.orbitPhase;
    if (!isPointerOver && !selectedStar) globePhaseRef.current += globePhaseDelta;

    if (clockRef.current) {
      // The rim drag writes straight into orientationRef, so the whole instrument
      // turns in real 3D — pitch and a full, unbounded yaw.
      clockRef.current.rotation.x = settle(clockRef.current.rotation.x, THREE.MathUtils.degToRad(orientation.x), damping);
      if (!isPointerOver) {
        precessionRef.current = reducedMotion || selectedStar ? 0 : Math.sin(clock.elapsedTime * 0.11) * THREE.MathUtils.degToRad(0.7);
      }
      clockRef.current.rotation.y = settleAngle(clockRef.current.rotation.y, THREE.MathUtils.degToRad(orientation.y) + precessionRef.current, damping);

      // It hangs from the crown, so moving it sets the whole body swinging on that pivot.
      if (reducedMotion || isPointerOver) {
        swingRef.current = { angle: REST_ROLL, velocity: 0 };
        clockRef.current.rotation.z = REST_ROLL;
      } else {
        const swing = swingRef.current;
        // Lean is driven by how fast the mount is turning, not by the raw frame delta —
        // otherwise a reset teleports the yaw and the body gets slammed into its stops.
        const yawRate = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(orientation.y - previousOrientation.current.y) / step, -10, 10);
        const pitchRate = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(orientation.x - previousOrientation.current.x) / step, -10, 10);
        const lean = THREE.MathUtils.clamp(yawRate * -0.035 + pitchRate * 0.012, -0.26, 0.26);
        swing.velocity += (REST_ROLL + lean - swing.angle) * 24 * step;
        swing.velocity *= Math.pow(0.14, step);
        swing.angle = THREE.MathUtils.clamp(swing.angle + swing.velocity * step, REST_ROLL - 0.34, REST_ROLL + 0.34);

        // Come to a true stop rather than asymptoting, so the DOM star labels settle too.
        if (Math.abs(swing.velocity) < 0.002 && Math.abs(swing.angle - REST_ROLL) < 0.002) {
          swing.angle = REST_ROLL;
          swing.velocity = 0;
        }

        clockRef.current.rotation.z = swing.angle;
      }
      previousOrientation.current = { x: orientation.x, y: orientation.y };

      const entry = easeOut(stage(assemblyRef.current, 0, 0.5));
      if (!isPointerOver) {
        breathRef.current = reducedMotion || selectedStar ? 1 : 1 + Math.sin(clock.elapsedTime * 0.42) * 0.0035;
      }
      clockRef.current.scale.setScalar(Math.max(0.001, entry) * breathRef.current);
    }

    if (cageRef.current) cageRef.current.rotation.z = transmissionRef.current.cage;

    if (globeMountRef.current && globeSpinRef.current) {
      const selectedPosition = selectedStar ? starPosition(selectedStar) : null;
      // Opening a chapter turns that star up to face the viewer: spin it round to the
      // meridian first, then tilt the mount until it sits square on.
      const targetSpin = selectedPosition
        ? -Math.atan2(selectedPosition.x, selectedPosition.z)
        : THREE.MathUtils.degToRad(globeRotationRef.current.y) + globePhaseRef.current;
      // Both cases are stated in viewer terms, then offset by the case's rest pitch so
      // that a globe rotation of zero puts the celestial equator square to the camera.
      const targetTilt =
        (selectedPosition
          ? Math.atan2(selectedPosition.y, Math.hypot(selectedPosition.x, selectedPosition.z))
          : THREE.MathUtils.degToRad(globeRotationRef.current.x)) - MOUNT_ELEVATION;

      globeSpinRef.current.rotation.y = settleAngle(globeSpinRef.current.rotation.y, targetSpin, damping);
      globeMountRef.current.rotation.x = settle(globeMountRef.current.rotation.x, targetTilt, damping);

      const entry = easeOut(stage(assemblyRef.current, 0.55, 0.95));
      globeMountRef.current.scale.setScalar(Math.max(0.001, entry));

      // Point the rule at whatever star is in play, in the case's own frame.
      if (aimedStar) {
        aimVector.copy(starPosition(aimedStar));
        aimVector.applyAxisAngle(Y_AXIS, globeSpinRef.current.rotation.y);
        aimVector.applyAxisAngle(X_AXIS, globeMountRef.current.rotation.x);
        aimRef.current = Math.atan2(aimVector.y, aimVector.x);
      } else {
        aimRef.current = null;
      }
    }
  });

  return (
    <group ref={clockRef} rotation={[THREE.MathUtils.degToRad(42), 0, REST_ROLL]}>
      <Case transmissionRef={transmissionRef} assemblyRef={assemblyRef} />

      <GlobeOrbitRing transmissionRef={transmissionRef} assemblyRef={assemblyRef} reducedMotion={reducedMotion} isReading={isReading} />

      {[0, 1, 2, 3].map((index) => (
        <TrainWheel key={index} seat={seatAngle(index)} transmissionRef={transmissionRef} assemblyRef={assemblyRef} order={index} />
      ))}
      <Escapement transmissionRef={transmissionRef} assemblyRef={assemblyRef} />

      {/* Equator, solstitial colure, and the marked ecliptic — three planes, not three tilts. */}
      <group ref={cageRef}>
        {/* Radii are held below the gear train's inner reach (~3.22 including outline
            shells). At 3.14 the outermost ring interpenetrated the ring-gear teeth. */}
        <CageRing rotation={[Math.PI / 2, 0, 0]} assemblyRef={assemblyRef} transmissionRef={transmissionRef} orbitRate={ORBIT_RATES.equatorial} orbitAxis="y" order={0} isReading={isReading} radius={2.82} color={palette.brass} />
        {/* Equinoctial colure. It must lie in XY, not YZ: a YZ ring is edge-on to the
            camera and renders as a hard bar straight down the middle of the map. */}
        <CageRing rotation={[0, 0, 0]} assemblyRef={assemblyRef} transmissionRef={transmissionRef} orbitRate={ORBIT_RATES.meridian} orbitAxis="x" order={1} isReading={isReading} radius={2.72} color={palette.brassDeep} />
        <group rotation={[0, 0, THREE.MathUtils.degToRad(23.5)]}>
          <CageRing rotation={[Math.PI / 2, 0, 0]} assemblyRef={assemblyRef} transmissionRef={transmissionRef} orbitRate={ORBIT_RATES.ecliptic} orbitAxis="y" order={2} isReading={isReading} radius={2.62} color={palette.brassLight} marked />
        </group>
      </group>

      {/* Mount tilts; the sphere spins on the axle inside it. */}
      <group ref={globeMountRef}>
        <group rotation={[0, 0, THREE.MathUtils.degToRad(23.5)]}>
          <PolarAxle />
          <group ref={globeSpinRef}>
            <Globe
              stars={stars}
              selectedId={selectedId}
              hoveredId={hoveredId}
              activeConstellation={activeConstellation}
              assemblyRef={assemblyRef}
              reducedMotion={reducedMotion}
              onOpenStar={onOpenStar}
              onHoverStar={onHoverStar}
            />
          </group>
        </group>
      </group>

      <Alidade transmissionRef={transmissionRef} aimRef={aimRef} assemblyRef={assemblyRef} />
    </group>
  );
}

export default function CelestialClock3D({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  zoomRef,
  isDragging,
  isSpinning,
  hoverZone,
  ...props
}: CelestialClock3DProps) {
  const piscesIds: Set<AstrolabeSection> = new Set(["pisces", "experience"]);
  const constellationSpotlight = piscesIds.has(props.selectedId!) || piscesIds.has(props.hoveredId!)
    ? "pisces"
    : props.selectedId || props.hoveredId
      ? "aries"
      : props.activeConstellation;

  return (
    <div
      className={`celestial-clock-3d${isDragging ? " is-dragging" : ""}${isSpinning ? " is-spinning" : ""}`}
      role="group"
      tabIndex={0}
      aria-label="Rotate the Aries celestial sphere"
      data-instrument-orientation={`${props.orientationRef.current.x.toFixed(2)},${props.orientationRef.current.y.toFixed(2)}`}
      data-globe-rotation={`${props.globeRotationRef.current.x.toFixed(2)},${props.globeRotationRef.current.y.toFixed(2)}`}
      data-constellation-spotlight={constellationSpotlight}
      data-cursor="drag"
      data-cursor-label={isDragging ? "Turning" : isSpinning ? "Coasting" : hoverZone === "frame" ? "Orbit" : "Rotate"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 14], zoom: 96 }}
        dpr={[1, 1.5]}
        // R3F puts pointer-events:auto inline on its container, which no stylesheet rule
        // can outrank. The instrument's hit area is .orrery__surface instead.
        style={{ pointerEvents: "none" }}
        gl={{ alpha: true, antialias: true, logarithmicDepthBuffer: true, stencil: false, powerPreference: "high-performance" }}
      >
        <CameraRig zoomRef={zoomRef} reducedMotion={props.reducedMotion} isFocused={Boolean(props.selectedId)} isPointerOver={props.isPointerOver} />
        <ambientLight intensity={2.2} color="#ffffff" />
        <ClockModel {...props} />
      </Canvas>
    </div>
  );
}
