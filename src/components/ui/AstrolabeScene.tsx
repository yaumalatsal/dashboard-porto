"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RotateCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import { gsap } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useUiStore, type AstrolabeSection } from "@/stores/uiStore";
import { profile } from "@/data/portfolio";
import {
  celestialMapCoordinates,
  celestialStar,
  constellationIdForStar,
  starScale,
  type ConstellationId,
} from "@/data/constellations";
import dynamic from "next/dynamic";
import type { ClockStar } from "@/components/three/CelestialClock3D";

/**
 * Loaded on demand rather than imported statically.
 *
 * As a static import this pulled three.js, @react-three/fiber and drei into the
 * shared client chunk, so every route — including /console and the 404 — paid
 * to download and parse the whole WebGL stack even though the guard below only
 * ever renders the instrument on "/".
 */
const CelestialClock3D = dynamic(
  () => import("@/components/three/CelestialClock3D"),
  { ssr: false },
);

type OrreryStar = ClockStar & {
  title: string;
  story: string;
};

type FocusPhase = "idle" | "targeting" | "reading" | "returning";

type PortfolioStarContent = Pick<ClockStar, "id" | "chapter" | "level" | "status"> & Pick<OrreryStar, "title" | "story">;

const portfolioStar = (key: string, content: PortfolioStarContent): OrreryStar => {
  const star = celestialStar(key);
  return { ...star, ...content, size: starScale(star.magnitude) };
};

const stars: OrreryStar[] = [
  portfolioStar("bharani", { id: "hero", chapter: "Start", title: profile.shortName, story: "I build web systems and I operate the networks below them.", level: "00", status: "Origin charted" }),
  portfolioStar("botein", { id: "contact", chapter: "Contact", title: "Bring the difficult map", story: "Selected commissions for digital products, interactive stories, service platforms, and systems that cross disciplines.", level: "05", status: "Signal open" }),
  portfolioStar("hamal", { id: "about", chapter: "About", title: "Making terrain legible", story: "I turn complex product and infrastructure problems into clear, expressive systems people can understand and use.", level: "01", status: "Primary route" }),
  portfolioStar("sheratan", { id: "work", chapter: "Projects", title: "Systems in context", story: "Selected work spanning observability, immersive storytelling, service operations, and design systems.", level: "02", status: "Four records" }),
  portfolioStar("mesarthim", { id: "skills", chapter: "Capabilities", title: "Four working layers", story: "Direction, product engineering, infrastructure, and operations form a single practical toolkit.", level: "03", status: "Kit calibrated" }),
  portfolioStar("eta-psc", { id: "experience", chapter: "Field Journal", title: "Beyond the workbench", story: "Conferences spoken at, communities built, and organisations shaped outside the daily practice.", level: "04", status: "Signal active" }),
  portfolioStar("alrescha", { id: "pisces", chapter: "The Knot", title: "Binding the threads", story: "Connecting disparate systems into a unified whole, just as Alrescha binds the two fishes.", level: "06", status: "New signal" }),
];

const rimGripPositions = ["north", "east", "south", "west"] as const;

/**
 * The reading overlay that used to open on a star was removed.
 *
 * A star click and a header link both scroll to the section now, so nothing
 * ever set `focusedPoint` to a star id and the panel could not open. It also
 * held the only references to the template artwork for the fictional projects,
 * which is why those images went with it.
 */

/** The instrument tips this far before the case starts hiding its own face. */
const PITCH_LIMIT = 82;

/** Yaw spins without limit, so only announce it folded back into a single turn. */
function normaliseYaw(yaw: number): number {
  return ((yaw % 360) + 360) % 360;
}

/**
 * The globe's radius as a fraction of the camera's half-frame (GLOBE_RADIUS / FRAME_RADIUS
 * in the 3D scene). Because the sphere is centred on the instrument's own rotation origin
 * and the camera is orthographic, its silhouette stays an exact circle of this size at
 * every orientation — so a plain radius test tells us precisely what the pointer is over.
 */
const SPHERE_FRAME_FRACTION = 2.45 / 5.15;


export default function AstrolabeScene() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const rimControlRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const manualRotationRef = useRef({ x: 0, y: 0 });
  const discOrientationRef = useRef({ x: 42, y: 0 });
  const discRotationRef = useRef(0);
  const zoomRef = useRef(1);
  const focusRequestRef = useRef<AstrolabeSection | null>(null);
  /** The sphere drifts on its own until the first touch, which is how you learn it moves. */
  const hasInteractedRef = useRef(false);
  const discInertiaFrameRef = useRef<number | null>(null);
  const globeInertiaFrameRef = useRef<number | null>(null);
  const dragStateRef = useRef({ pointerId: -1, startX: 0, startY: 0, startRotateX: 0, startRotateY: 0, lastX: 0, lastY: 0, lastTime: 0, velocityX: 0, velocityY: 0 });
  const rimDragStateRef = useRef({ pointerId: -1, startX: 0, startY: 0, startRotateX: 42, startRotateY: 0, lastX: 0, lastY: 0, lastTime: 0, velocityX: 0, velocityY: 0 });
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [hoveredId, setHoveredId] = useState<AstrolabeSection | null>(null);
  const [hoverZone, setHoverZone] = useState<"sky" | "frame">("sky");
  const [isDragging, setIsDragging] = useState(false);
  const [isGlobeSpinning, setIsGlobeSpinning] = useState(false);
  const [isDiscDragging, setIsDiscDragging] = useState(false);
  const [isDiscSpinning, setIsDiscSpinning] = useState(false);
  const [discOrientation, setDiscOrientation] = useState({ x: 42, y: 0 });
  const [focusPhase, setFocusPhase] = useState<FocusPhase>("idle");
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [activeConstellation, setActiveConstellation] = useState<ConstellationId>("aries");
  /** The "select a star" cue has done its job once a chapter has actually been opened. */
  const [hasOpenedChapter, setHasOpenedChapter] = useState(false);
  const pathname = usePathname();
  const [isPastHero, setIsPastHero] = useState(false);

  // The hero is 136svh with a sticky stage, so the instrument has served its
  // purpose by the time the reader is ~70% of a viewport down.
  useEffect(() => {
    const update = () => setIsPastHero(window.scrollY > window.innerHeight * 0.7);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const prefersReducedMotion = useReducedMotion();
  const isLoaderComplete = useUiStore((state) => state.isLoaderComplete);
  const focusedPoint = useUiStore((state) => state.focusedPoint);
  const navHoveredPoint = useUiStore((state) => state.hoveredPoint);
  const setActiveSection = useUiStore((state) => state.setActiveSection);
  const setFocusedPoint = useUiStore((state) => state.setFocusedPoint);
  const setHoveredPoint = useUiStore((state) => state.setHoveredPoint);
  const selectedStar = stars.find((star) => star.id === focusedPoint) ?? null;
  // A star lights up whether you point at it on the instrument or at its entry in the
  // header — one highlighted coordinate, two ways in.
  const activeHoverId = hoveredId ?? navHoveredPoint;
  const hoveredStar = stars.find((star) => star.id === activeHoverId) ?? null;

  useEffect(() => {
    updateReadout(manualRotationRef.current.x, manualRotationRef.current.y);

    let animationFrameId: number;
    const tick = () => {
      if (!isDragging && !isDiscDragging) {
        discRotationRef.current += hasInteractedRef.current ? 0.045 : 0.08;
        if (sceneRef.current) {
          sceneRef.current.style.setProperty("--spin-angle", `${discRotationRef.current.toFixed(2)}deg`);
        }
      }
      document.documentElement.style.setProperty("--orbit-drift", `${(Math.sin((discRotationRef.current * 0.12 * Math.PI) / 180) * 2.5).toFixed(3)}deg`);
      animationFrameId = requestAnimationFrame(tick);
    };
    if (!prefersReducedMotion) {
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (discInertiaFrameRef.current !== null) cancelAnimationFrame(discInertiaFrameRef.current);
      if (globeInertiaFrameRef.current !== null) cancelAnimationFrame(globeInertiaFrameRef.current);
    };
  }, [prefersReducedMotion, isDragging, isDiscDragging, focusedPoint]);

  const updateSpinCss = () => {
    if (sceneRef.current) {
      sceneRef.current.style.setProperty("--spin-angle", `${discRotationRef.current.toFixed(2)}deg`);
    }
    document.documentElement.style.setProperty("--orbit-drift", `${(Math.sin((discRotationRef.current * 0.12 * Math.PI) / 180) * 2.5).toFixed(3)}deg`);
  };

  /** Turns the sphere's current attitude into the coordinates the instrument is reading. */
  const updateReadout = (rotateX: number, rotateY: number) => {
    if (!readoutRef.current) return;
    const hours = (normaliseYaw(-rotateY) / 360) * 24;
    const declination = Math.round(gsap.utils.clamp(-89, 89, rotateX));
    readoutRef.current.textContent = `RA ${String(Math.floor(hours)).padStart(2, "0")}h ${String(Math.floor((hours % 1) * 60)).padStart(2, "0")}m / DEC ${declination >= 0 ? "+" : "−"}${String(Math.abs(declination)).padStart(2, "0")}°`;
  };

  const rotateGlobe = (rotateX: number, rotateY: number) => {
    const previous = manualRotationRef.current;
    manualRotationRef.current = { x: rotateX, y: rotateY };
    discRotationRef.current += (rotateY - previous.y) * 0.055 - (rotateX - previous.x) * 0.035;
    updateSpinCss();
    updateReadout(rotateX, rotateY);
    sceneRef.current?.querySelector(".celestial-clock-3d")?.setAttribute("data-globe-rotation", `${rotateX.toFixed(2)},${rotateY.toFixed(2)}`);
  };

  const markInteracted = () => {
    hasInteractedRef.current = true;
  };

  const setInstrumentZoom = (zoom: number) => {
    zoomRef.current = zoom;
    sceneRef.current?.style.setProperty("--instrument-zoom", zoom.toFixed(3));
    sceneRef.current?.querySelector(".celestial-clock-3d")?.setAttribute("data-camera-zoom", zoom.toFixed(3));
  };

  /**
   * Wheel dollies in on the sphere. The ceiling is the point where the case would start
   * shearing against the canvas edge (CANVAS_OVERSCAN / case-to-frame ratio) — past that
   * you only see a wall of purple anyway.
   */
  const handleZoom = (delta: number) => {
    markInteracted();
    setInstrumentZoom(gsap.utils.clamp(0.85, 1.45, zoomRef.current * (1 - delta * 0.0011)));
  };

  /**
   * Writes straight into the ref the WebGL scene reads each frame — the instrument turns
   * as a real 3D object rather than as a tilted flat canvas.
   */
  const orientDisc = (rotateX: number, rotateY: number, commit = false, driveDelta = 0) => {
    discOrientationRef.current = { x: rotateX, y: rotateY };
    discRotationRef.current += driveDelta;
    updateSpinCss();
    rimControlRef.current?.setAttribute("aria-label", `Rotate the complete celestial instrument in three dimensions. Current pitch ${Math.round(rotateX)} degrees, yaw ${Math.round(normaliseYaw(rotateY))} degrees`);
    sceneRef.current?.querySelector(".celestial-clock-3d")?.setAttribute("data-instrument-orientation", `${rotateX.toFixed(2)},${rotateY.toFixed(2)}`);

    if (commit) setDiscOrientation({ x: rotateX, y: rotateY });
  };

  const stopDiscInertia = () => {
    if (discInertiaFrameRef.current !== null) {
      cancelAnimationFrame(discInertiaFrameRef.current);
      discInertiaFrameRef.current = null;
    }
    setIsDiscSpinning(false);
  };

  const startDiscInertia = (initialVelocityX: number, initialVelocityY: number) => {
    stopDiscInertia();
    if (prefersReducedMotion) {
      orientDisc(Math.round(discOrientationRef.current.x / 2) * 2, Math.round(discOrientationRef.current.y / 2) * 2, true);
      return;
    }

    let rotateX = discOrientationRef.current.x;
    let rotateY = discOrientationRef.current.y;
    let velocityX = gsap.utils.clamp(-0.7, 0.7, initialVelocityX);
    let velocityY = gsap.utils.clamp(-0.7, 0.7, initialVelocityY);
    let previousTime = 0;
    let isSettling = false;
    let detentX = rotateX;
    let detentY = rotateY;
    setIsDiscSpinning(true);

    const advance = (time: number) => {
      if (previousTime === 0) previousTime = time;
      const deltaTime = Math.min(32, Math.max(1, time - previousTime));
      previousTime = time;
      rotateX += velocityX * deltaTime;
      rotateY += velocityY * deltaTime;

      if (rotateX < -PITCH_LIMIT || rotateX > PITCH_LIMIT) {
        rotateX = gsap.utils.clamp(-PITCH_LIMIT, PITCH_LIMIT, rotateX);
        velocityX *= -0.24;
      }

      const decay = Math.pow(0.952, deltaTime / 16.67);
      velocityX *= decay;
      velocityY *= decay;

      if (!isSettling && Math.hypot(velocityX, velocityY) < 0.015) {
        isSettling = true;
        detentX = Math.round(rotateX / 2) * 2;
        detentY = Math.round(rotateY / 2) * 2;
      }

      if (isSettling) {
        const errorX = detentX - rotateX;
        const errorY = detentY - rotateY;
        velocityX += errorX * 0.00105 * deltaTime;
        velocityY += errorY * 0.00105 * deltaTime;
        const springDecay = Math.pow(0.74, deltaTime / 16.67);
        velocityX *= springDecay;
        velocityY *= springDecay;

        if (Math.hypot(errorX, errorY) < 0.045 && Math.hypot(velocityX, velocityY) < 0.002) {
          orientDisc(detentX, detentY, true);
          discInertiaFrameRef.current = null;
          setIsDiscSpinning(false);
          return;
        }
      }

      orientDisc(rotateX, rotateY, false, (velocityY - velocityX) * deltaTime * 0.18);
      discInertiaFrameRef.current = requestAnimationFrame(advance);
    };

    discInertiaFrameRef.current = requestAnimationFrame(advance);
  };

  const handleRimPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (selectedStar) return;
    event.preventDefault();
    event.stopPropagation();
    markInteracted();
    stopDiscInertia();
    event.currentTarget.setPointerCapture(event.pointerId);
    rimDragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startRotateX: discOrientationRef.current.x, startRotateY: discOrientationRef.current.y, lastX: event.clientX, lastY: event.clientY, lastTime: event.timeStamp, velocityX: 0, velocityY: 0 };
    setIsDiscDragging(true);
  };

  const handleRimPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (rimDragStateRef.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const drag = rimDragStateRef.current;
    const deltaTime = Math.max(8, event.timeStamp - drag.lastTime);
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;

    let driveDelta = deltaX * 0.08 - deltaY * 0.05;
    const rect = sceneRef.current?.getBoundingClientRect();
    if (rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const prevAngle = Math.atan2(drag.lastY - cy, drag.lastX - cx);
      const currAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
      let circularDelta = (currAngle - prevAngle) * (180 / Math.PI);
      if (circularDelta > 180) circularDelta -= 360;
      if (circularDelta < -180) circularDelta += 360;
      if (Math.abs(circularDelta) < 45) {
        driveDelta += circularDelta * 1.25;
      }
    }

    const measuredVelocityX = (deltaY * -0.16) / deltaTime;
    const measuredVelocityY = (deltaX * 0.18) / deltaTime;
    drag.velocityX = drag.velocityX * 0.58 + measuredVelocityX * 0.42;
    drag.velocityY = drag.velocityY * 0.58 + measuredVelocityY * 0.42;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    const rotateX = gsap.utils.clamp(-PITCH_LIMIT, PITCH_LIMIT, drag.startRotateX - (event.clientY - drag.startY) * 0.16);
    const rotateY = drag.startRotateY + (event.clientX - drag.startX) * 0.24;
    orientDisc(rotateX, rotateY, false, driveDelta);
  };

  const finishRimDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (rimDragStateRef.current.pointerId !== event.pointerId) return;
    const drag = rimDragStateRef.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    rimDragStateRef.current.pointerId = -1;
    setDiscOrientation(discOrientationRef.current);
    setIsDiscDragging(false);
    startDiscInertia(drag.velocityX, drag.velocityY);
  };

  const handleRimKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (selectedStar || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    markInteracted();
    stopDiscInertia();
    const step = event.shiftKey ? 15 : 5;
    const rotateX = gsap.utils.clamp(-PITCH_LIMIT, PITCH_LIMIT, discOrientationRef.current.x + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0));
    const rotateY = discOrientationRef.current.y + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0);
    orientDisc(rotateX, rotateY, true, (rotateY - discOrientationRef.current.y) * 0.25 - (rotateX - discOrientationRef.current.x) * 0.18);
  };

  const stopGlobeInertia = () => {
    if (globeInertiaFrameRef.current !== null) {
      cancelAnimationFrame(globeInertiaFrameRef.current);
      globeInertiaFrameRef.current = null;
    }
    setIsGlobeSpinning(false);
  };

  const startGlobeInertia = (initialVelocityX: number, initialVelocityY: number) => {
    stopGlobeInertia();
    if (prefersReducedMotion) {
      rotateGlobe(Math.round(manualRotationRef.current.x / 3) * 3, Math.round(manualRotationRef.current.y / 3) * 3);
      return;
    }

    let rotateX = manualRotationRef.current.x;
    let rotateY = manualRotationRef.current.y;
    let velocityX = gsap.utils.clamp(-0.55, 0.55, initialVelocityX);
    let velocityY = gsap.utils.clamp(-0.72, 0.72, initialVelocityY);
    let previousTime = 0;
    let isSettling = false;
    let detentX = rotateX;
    let detentY = rotateY;
    setIsGlobeSpinning(true);

    const advance = (time: number) => {
      if (previousTime === 0) previousTime = time;
      const deltaTime = Math.min(32, Math.max(1, time - previousTime));
      previousTime = time;
      rotateX += velocityX * deltaTime;
      rotateY += velocityY * deltaTime;

      if (rotateX < -36 || rotateX > 36) {
        rotateX = gsap.utils.clamp(-36, 36, rotateX);
        velocityX *= -0.2;
      }

      const decay = Math.pow(0.944, deltaTime / 16.67);
      velocityX *= decay;
      velocityY *= decay;

      if (!isSettling && Math.hypot(velocityX, velocityY) < 0.012) {
        isSettling = true;
        detentX = Math.round(rotateX / 3) * 3;
        detentY = Math.round(rotateY / 3) * 3;
      }

      if (isSettling) {
        const errorX = detentX - rotateX;
        const errorY = detentY - rotateY;
        velocityX += errorX * 0.0012 * deltaTime;
        velocityY += errorY * 0.0012 * deltaTime;
        const springDecay = Math.pow(0.7, deltaTime / 16.67);
        velocityX *= springDecay;
        velocityY *= springDecay;

        if (Math.hypot(errorX, errorY) < 0.04 && Math.hypot(velocityX, velocityY) < 0.002) {
          rotateGlobe(detentX, detentY);
          globeInertiaFrameRef.current = null;
          setIsGlobeSpinning(false);
          return;
        }
      }

      rotateGlobe(rotateX, rotateY);
      globeInertiaFrameRef.current = requestAnimationFrame(advance);
    };

    globeInertiaFrameRef.current = requestAnimationFrame(advance);
  };

  const handleGlobePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (selectedStar || (event.target instanceof Element && event.target.closest("button, a"))) return;
    event.preventDefault();
    // The sphere's grip sits inside the frame's, so claim the gesture before it bubbles.
    event.stopPropagation();
    markInteracted();
    stopGlobeInertia();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRotateX: manualRotationRef.current.x,
      startRotateY: manualRotationRef.current.y,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
    };
    setIsDragging(true);
  };

  const handleGlobePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const drag = dragStateRef.current;
    const deltaTime = Math.max(8, event.timeStamp - drag.lastTime);
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    const measuredVelocityX = (deltaY * -0.14) / deltaTime;
    const measuredVelocityY = (deltaX * 0.19) / deltaTime;
    drag.velocityX = drag.velocityX * 0.54 + measuredVelocityX * 0.46;
    drag.velocityY = drag.velocityY * 0.54 + measuredVelocityY * 0.46;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    const rotateY = drag.startRotateY + (event.clientX - drag.startX) * 0.19;
    const rotateX = gsap.utils.clamp(-36, 36, drag.startRotateX - (event.clientY - drag.startY) * 0.14);
    rotateGlobe(rotateX, rotateY);
  };

  const finishGlobeDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const drag = dragStateRef.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragStateRef.current.pointerId = -1;
    setIsDragging(false);
    startGlobeInertia(drag.velocityX, drag.velocityY);
  };

  const handleGlobeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (selectedStar || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    markInteracted();
    stopGlobeInertia();
    const step = event.shiftKey ? 8 : 4;
    const nextX = gsap.utils.clamp(-36, 36, manualRotationRef.current.x + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0));
    const nextY = manualRotationRef.current.y + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0);
    rotateGlobe(nextX, nextY);
  };

  /** True when the gesture starts over the celestial sphere rather than the brass frame. */
  const isOverSphere = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - (rect.left + rect.width / 2);
    const offsetY = event.clientY - (rect.top + rect.height / 2);
    const radius = (Math.min(rect.width, rect.height) / 2) * SPHERE_FRAME_FRACTION * zoomRef.current;
    return Math.hypot(offsetX, offsetY) <= radius;
  };

  /**
   * One surface, two gestures, routed by where you grabbed: the sphere sweeps the sky,
   * the surrounding frame orbits the whole instrument. Previously only four narrow strips
   * at the very edge could orbit it, which made the instrument feel stuck.
   */
  const handleInstrumentPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (selectedStar || focusPhase !== "idle" || (event.target instanceof Element && event.target.closest("button, a"))) return;
    if (isOverSphere(event)) handleGlobePointerDown(event);
    else handleRimPointerDown(event);
  };

  // Both are pointer-id guarded, so only the live drag responds. While idle, track which
  // zone the pointer is over so the cursor can say what a drag would do.
  const handleInstrumentPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId === -1 && rimDragStateRef.current.pointerId === -1) {
      // The introductory sky drift teaches that the globe moves, but it must stop as
      // soon as the user approaches so a plotted coordinate never runs from the cursor.
      markInteracted();
      const zone = isOverSphere(event) ? "sky" : "frame";
      if (zone !== hoverZone) setHoverZone(zone);
    }

    handleGlobePointerMove(event);
    handleRimPointerMove(event);
  };

  const handleInstrumentPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    finishGlobeDrag(event);
    finishRimDrag(event);
  };

  const targetFocusTweenRef = useRef<gsap.core.Timeline | null>(null);

  const animateTargetFocus = (
    targetGlobeX: number,
    targetGlobeY: number,
    targetDiscX: number = 18,
    targetDiscY: number = 0,
    targetZoom: number = 1,
    onReveal?: () => void,
  ) => {
    stopDiscInertia();
    stopGlobeInertia();

    if (targetFocusTweenRef.current) {
      targetFocusTweenRef.current.kill();
    }

    // Take the shortest way round rather than unwinding a whole turn.
    const currentY = manualRotationRef.current.y;
    const finalGlobeY = currentY + (((targetGlobeY - currentY + 180) % 360) - 180);

    const currentDiscY = discOrientationRef.current.y;
    const finalDiscY = currentDiscY + (((targetDiscY - currentDiscY + 180) % 360) - 180);

    const proxy = {
      globeX: manualRotationRef.current.x,
      globeY: currentY,
      discX: discOrientationRef.current.x,
      discY: currentDiscY,
      zoom: zoomRef.current,
    };

    let hasRevealed = false;
    targetFocusTweenRef.current = gsap.timeline({
      onUpdate: () => {
        rotateGlobe(proxy.globeX, proxy.globeY);
        orientDisc(proxy.discX, proxy.discY, false);
        setInstrumentZoom(proxy.zoom);
        if (!hasRevealed && onReveal && (targetFocusTweenRef.current?.progress() ?? 0) >= 0.55) {
          hasRevealed = true;
          onReveal();
        }
      },
      onComplete: () => {
        orientDisc(proxy.discX, proxy.discY, true);
        if (!hasRevealed && onReveal) onReveal();
      },
    });

    if (prefersReducedMotion) {
      // Skip choreography, jump directly
      targetFocusTweenRef.current.to(proxy, {
        globeX: targetGlobeX,
        globeY: finalGlobeY,
        discX: targetDiscX,
        discY: finalDiscY,
        zoom: targetZoom,
        duration: 0.18,
        ease: "power2.out",
      });
    } else {
      // Fancy mechanical ring gear spin impulse on each section transition
      discRotationRef.current += finalGlobeY > proxy.globeY ? 75 : -75;

      // Phase 1: Pull-back anticipation — slight zoom out + gentle yaw drift
      const anticipationZoom = Math.max(0.82, proxy.zoom * 0.9);
      const anticipationYaw = proxy.globeY + (finalGlobeY > proxy.globeY ? -10 : 10);
      targetFocusTweenRef.current
        .to(proxy, {
          zoom: anticipationZoom,
          globeY: anticipationYaw,
          duration: 0.38,
          ease: "power2.out",
        })
        // Phase 2: Cinematic approach with overshoot settle
        .to(proxy, {
          globeX: targetGlobeX,
          globeY: finalGlobeY,
          discX: targetDiscX,
          discY: finalDiscY,
          zoom: targetZoom,
          duration: 0.88,
          ease: "back.out(1.18)",
        });
    }
  };

  const focusStar = (star: ClockStar) => {
    setHoveredId(null);
    setActiveConstellation(constellationIdForStar(star));
    setFocusPhase("targeting");

    const mapCoordinates = celestialMapCoordinates(star);
    const targetGlobeY = -mapCoordinates.longitude;
    const targetGlobeX = mapCoordinates.latitude;

    // Closing in far enough to read the coordinate, but not so far that the globe becomes a
    // full-bleed wall behind the chapter text. The instrument also slides off the copy
    // column in CSS (.astrolabe-scene.has-focus), so the two occupy separate ground.
    animateTargetFocus(targetGlobeX, targetGlobeY, 8, 0, 1.12, () => setFocusPhase("reading"));
  };

  /**
   * Clicking a star scrolls to that section.
   *
   * The instrument is now the opening statement above a real portfolio rather
   * than the only way in, so a star is a shortcut to the same content everyone
   * else reaches by scrolling. Two different presentations of one project would
   * be two things to keep in sync and two places for a reader to get lost.
   */
  const openMapPoint = (star: ClockStar) => {
    markInteracted();
    setHasOpenedChapter(true);
    setHoveredId(null);
    setHoveredPoint(null);
    setActiveSection(star.id);

    if (star.id === "hero") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    document
      .getElementById(star.id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleStarHover = (id: AstrolabeSection | null) => {
    if (id) {
      markInteracted();
      stopDiscInertia();
      stopGlobeInertia();
    }
    setHoveredId(id);
    // Mirrored into the store so the matching header entry lights at the same time.
    setHoveredPoint(id);
  };

  const returnToMap = () => {
    setFocusPhase("returning");
    animateTargetFocus(0, 0, 42, 0, 1, () => setFocusPhase("idle"));
  };

  const closeMapPoint = () => {
    focusRequestRef.current = null;
    setFocusedPoint(null);
    setActiveSection("hero");
    returnToMap();
  };

  const resetInstrument = () => {
    markInteracted();
    stopDiscInertia();
    stopGlobeInertia();
    targetFocusTweenRef.current?.kill();
    focusRequestRef.current = null;
    setFocusedPoint(null);
    setActiveSection("hero");
    setFocusPhase("idle");
    rotateGlobe(0, 0);
    discRotationRef.current = 0;
    setInstrumentZoom(1);
    orientDisc(42, 0, true);
  };

  // Long-lived listeners reach the latest handlers through refs
  const handleZoomRef = useRef(handleZoom);
  const focusStarRef = useRef(focusStar);
  const returnToMapRef = useRef(returnToMap);
  const openMapPointRef = useRef(openMapPoint);
  const closeMapPointRef = useRef(closeMapPoint);
  const lastScrollStepTimeRef = useRef(0);

  useEffect(() => {
    handleZoomRef.current = handleZoom;
    focusStarRef.current = focusStar;
    returnToMapRef.current = returnToMap;
    openMapPointRef.current = openMapPoint;
    closeMapPointRef.current = closeMapPoint;
  });

  const stepToNextStar = () => {
    const currentIndex = stars.findIndex((s) => s.id === focusedPoint);
    const nextIndex = currentIndex < 0 ? 0 : Math.min(stars.length - 1, currentIndex + 1);
    if (nextIndex !== currentIndex || currentIndex < 0) {
      openMapPointRef.current(stars[nextIndex]);
    }
  };

  const stepToPrevStar = () => {
    const currentIndex = stars.findIndex((s) => s.id === focusedPoint);
    if (currentIndex > 0) {
      openMapPointRef.current(stars[currentIndex - 1]);
    } else if (currentIndex === 0) {
      closeMapPointRef.current();
    }
  };

  const stepToNextStarRef = useRef(stepToNextStar);
  const stepToPrevStarRef = useRef(stepToPrevStar);
  useEffect(() => {
    stepToNextStarRef.current = stepToNextStar;
    stepToPrevStarRef.current = stepToPrevStar;
  });

  // Header and mobile navigation write to the shared store directly
  useEffect(() => {
    if (focusedPoint && focusRequestRef.current !== focusedPoint) {
      const star = stars.find((candidate) => candidate.id === focusedPoint);
      if (!star) return;
      focusRequestRef.current = focusedPoint;
      focusStarRef.current(star);
    } else if (!focusedPoint && focusRequestRef.current !== null) {
      focusRequestRef.current = null;
      returnToMapRef.current();
    }
  }, [focusedPoint]);

  // Smoothly align celestial globe with the section currently in scroll view
  const activeSection = useUiStore((state) => state.activeSection);
  useEffect(() => {
    if (focusedPoint || isDragging || isDiscDragging) return;
    const star = stars.find((candidate) => candidate.id === activeSection);
    if (!star) return;

    setActiveConstellation(constellationIdForStar(star));
    const coords = celestialMapCoordinates(star);
    const targetY = -coords.longitude;
    const targetX = coords.latitude;

    if (!prefersReducedMotion) {
      gsap.to(manualRotationRef.current, {
        x: targetX,
        y: targetY,
        duration: 1.4,
        ease: "power2.out",
        onUpdate: () => {
          rotateGlobe(manualRotationRef.current.x, manualRotationRef.current.y);
        },
      });
    }
  }, [activeSection, focusedPoint, isDragging, isDiscDragging, prefersReducedMotion]);

  // Handle zoom when user wheels directly over the 3D instrument surface
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const onSurfaceWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      handleZoomRef.current(event.deltaY);
    };

    surface.addEventListener("wheel", onSurfaceWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onSurfaceWheel);
  }, [isClient]);

  // Keyboard navigation (ArrowDown/PageDown -> next, ArrowUp/PageUp -> prev)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && focusedPoint) {
        closeMapPoint();
      } else if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === "ArrowRight") {
        if (focusedPoint) {
          event.preventDefault();
          stepToNextStar();
        }
      } else if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "ArrowLeft") {
        if (focusedPoint) {
          event.preventDefault();
          stepToPrevStar();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!isClient || pathname !== "/") return null;

  return (
    <div ref={sceneRef} className={`astrolabe-scene has-full-3d${isPastHero ? " is-past-hero" : ""}${selectedStar ? " has-focus" : ""}${focusPhase === "targeting" ? " is-targeting" : ""}${focusPhase === "reading" ? " is-reading" : ""}${focusPhase === "returning" ? " is-returning" : ""}${isDiscSpinning ? " is-clock-spinning" : ""}${isGlobeSpinning ? " is-map-spinning" : ""}`} data-focus-phase={focusPhase} data-hero-instrument>
      <div className="astrolabe-scene__instrument orrery" onPointerEnter={() => setIsPointerInside(true)} onPointerLeave={() => setIsPointerInside(false)}>
        {/* The whole instrument — case, gear train, armillary cage, celestial globe — is one
            WebGL model so every part turns together through a full 360. */}
        {/* Circular hit area sized to the instrument. The canvas itself is wider (zoom
            headroom) and inert, so it cannot sit over the nav or the hero copy. */}
        <div
          ref={surfaceRef}
          className={`orrery__surface${isDragging || isDiscDragging ? " is-dragging" : ""}`}
          data-cursor="drag"
          data-cursor-label={isDragging || isDiscDragging ? "Turning" : isGlobeSpinning || isDiscSpinning ? "Coasting" : hoverZone === "frame" ? "Orbit" : "Sweep sky"}
          onPointerDown={handleInstrumentPointerDown}
          onPointerMove={handleInstrumentPointerMove}
          onPointerUp={handleInstrumentPointerUp}
          onPointerCancel={handleInstrumentPointerUp}
        />

        <CelestialClock3D stars={stars} selectedId={focusedPoint} hoveredId={activeHoverId} activeConstellation={activeConstellation} orientationRef={discOrientationRef} globeRotationRef={manualRotationRef} driveRotationRef={discRotationRef} zoomRef={zoomRef} reducedMotion={prefersReducedMotion} isRevealed={isLoaderComplete} isReading={focusPhase === "reading"} isPointerOver={isPointerInside} onOpenStar={openMapPoint} onHoverStar={handleStarHover} onPointerDown={handleInstrumentPointerDown} onPointerMove={handleInstrumentPointerMove} onPointerUp={handleInstrumentPointerUp} onPointerCancel={handleInstrumentPointerUp} onKeyDown={handleGlobeKeyDown} isDragging={isDragging || isDiscDragging} isSpinning={isGlobeSpinning || isDiscSpinning} hoverZone={hoverZone} />

        <div className="orrery-map-switch" role="group" aria-label="Constellation map">
          {(["aries", "pisces"] as const).map((constellation) => (
            <button
              key={constellation}
              type="button"
              aria-pressed={activeConstellation === constellation}
              disabled={Boolean(selectedStar)}
              onClick={() => {
                setHoveredId(null);
                setActiveConstellation(constellation);
              }}
            >
              {constellation}
            </button>
          ))}
        </div>

        <div ref={mapRef} className="orrery-map" aria-live="polite">
          <div className={`orrery-map-preview${hoveredStar && !selectedStar ? " is-visible" : ""}`} aria-live="polite">
            {hoveredStar && !selectedStar && <>
              <p>Level {hoveredStar.level} / {hoveredStar.designation}</p>
              <span>{hoveredStar.status}</span>
              <strong>{hoveredStar.chapter}</strong>
            </>}
          </div>

        </div>

        {/* Anywhere on the frame orbits the instrument; the sphere's own grip sits on top. */}
        <div ref={rimControlRef} className={`orrery__rim-control${isDiscDragging ? " is-dragging" : ""}${isDiscSpinning ? " is-spinning" : ""}`} role="group" tabIndex={selectedStar ? -1 : 0} aria-label={`Rotate the complete celestial instrument in three dimensions. Current pitch ${Math.round(discOrientation.x)} degrees, yaw ${Math.round(discOrientation.y)} degrees`} data-cursor="drag" data-cursor-label={isDiscDragging ? "Turning" : isDiscSpinning ? "Coasting" : "Orbit"} onKeyDown={handleRimKeyDown} onPointerDown={handleRimPointerDown} onPointerMove={handleRimPointerMove} onPointerUp={finishRimDrag} onPointerCancel={finishRimDrag}>
          {rimGripPositions.map((position) => <span key={position} className={`orrery__rim-grip orrery__rim-grip--${position}`} data-cursor="drag" data-cursor-label={isDiscDragging ? "Turning" : isDiscSpinning ? "Coasting" : "Orbit"} onPointerDown={handleRimPointerDown} onPointerMove={handleRimPointerMove} onPointerUp={finishRimDrag} onPointerCancel={finishRimDrag} />)}
        </div>

        <button className="orrery__reset" type="button" onClick={resetInstrument} aria-label="Reset celestial instrument" title="Reset instrument"><RotateCcw aria-hidden="true" /></button>
      </div>

      {/* Live attitude of the star sphere — the instrument reads out what you have turned it to. */}
      <p ref={readoutRef} className="orrery__readout" aria-hidden="true">RA 00h 00m / DEC +00°</p>

      {/* One line, not four.
          The instrument used to carry a headline plus a three-gesture legend,
          which is an interface admitting it is not self-evident — and it is now
          the secondary way into the work anyway, since the page scrolls. The
          single remaining hint retires itself once a star has been used. */}
      <div className={`orrery__guide${hasOpenedChapter ? " is-learned" : ""}`}>
        <p className="orrery__instruction">
          <span className="orrery__instruction-mark" aria-hidden="true" />
          Turn the instrument. <span>Select a star to go to that section.</span>
        </p>
      </div>
    </div>
  );
}
