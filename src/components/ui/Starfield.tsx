"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Star {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  opacity: number;
  speed: number;
  twinklePhase: number;
  twinkleSpeed: number;
  depth: number;
}

/** Density per megapixel rather than a flat count, so a phone is not asked to
 *  draw the same 600 stars as a 4K monitor. */
const STARS_PER_MEGAPIXEL = 150;
const MAX_STARS = 320;
const MIN_STARS = 90;

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId = 0;
    let running = false;
    let stars: Star[] = [];
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const starCount = () => {
      const megapixels = (window.innerWidth * window.innerHeight) / 1_000_000;
      return Math.round(
        Math.min(MAX_STARS, Math.max(MIN_STARS, megapixels * STARS_PER_MEGAPIXEL)),
      );
    };

    const initStars = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = starCount();
      stars = [];
      for (let i = 0; i < count; i++) {
        const baseOpacity = Math.random() * 0.7 + 0.15;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: Math.random() * 1.4 + 0.3,
          baseOpacity,
          opacity: baseOpacity,
          speed: Math.random() * 0.12 + 0.02,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.015 + 0.005,
          depth: Math.random() * 0.8 + 0.2,
        });
      }
    };

    const resize = () => {
      // 1.5 is the knee of the curve: past it the extra pixels cost real frame
      // time on HiDPI laptops and nobody can see a sharper 1px star.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
      if (!running) paint();
    };

    const paint = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.fillStyle = "#10091d";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fdf8e1";

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const renderX = star.x + pointer.x * star.depth * 28;
        const renderY = star.y + pointer.y * star.depth * 18;
        ctx.globalAlpha = star.opacity;
        ctx.beginPath();
        ctx.arc(renderX, renderY, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    const tick = () => {
      pointer.x += (pointer.targetX - pointer.x) * 0.035;
      pointer.y += (pointer.targetY - pointer.y) * 0.035;

      const h = window.innerHeight;
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.twinklePhase += star.twinkleSpeed;
        star.opacity = star.baseOpacity + Math.sin(star.twinklePhase) * 0.2;
        star.y -= star.speed;
        if (star.y < -2) {
          star.y = h + 2;
          star.x = Math.random() * window.innerWidth;
        }
      }

      paint();
      animationFrameId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || prefersReducedMotion) return;
      running = true;
      animationFrameId = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(animationFrameId);
    };

    // A hidden tab still runs rAF in some browsers and always wastes battery in
    // the rest; there is nothing to see, so stop entirely.
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const updatePointer = (event: PointerEvent) => {
      pointer.targetX = event.clientX / window.innerWidth - 0.5;
      pointer.targetY = event.clientY / window.innerHeight - 0.5;
    };

    resize();

    if (prefersReducedMotion) {
      // Previously the loop still ran at 60fps here and simply skipped the
      // movement maths — all of the cost, none of the effect. Paint the sky
      // once and leave the main thread alone.
      paint();
    } else {
      start();
      window.addEventListener("pointermove", updatePointer, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
    }

    window.addEventListener("resize", resize, { passive: true });

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", updatePointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -5,
        pointerEvents: "none",
      }}
    />
  );
}
