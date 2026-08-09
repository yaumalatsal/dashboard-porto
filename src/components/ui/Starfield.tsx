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

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let stars: Star[] = [];
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const numStars = 600;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
    };

    const initStars = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      stars = [];
      for (let i = 0; i < numStars; i++) {
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

    const updatePointer = (event: PointerEvent) => {
      pointer.targetX = event.clientX / window.innerWidth - 0.5;
      pointer.targetY = event.clientY / window.innerHeight - 0.5;
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.fillStyle = "#10091d";
      ctx.fillRect(0, 0, w, h);

      // No shadowBlur — draw glow as a larger translucent circle instead
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      if (!prefersReducedMotion) {
        pointer.x += (pointer.targetX - pointer.x) * 0.035;
        pointer.y += (pointer.targetY - pointer.y) * 0.035;
      }

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        if (!prefersReducedMotion) {
          star.twinklePhase += star.twinkleSpeed;
          star.opacity = star.baseOpacity + Math.sin(star.twinklePhase) * 0.2;
          star.y -= star.speed;
          if (star.y < -2) {
            star.y = h + 2;
            star.x = Math.random() * w;
          }
        }

        const renderX = star.x + pointer.x * star.depth * 28;
        const renderY = star.y + pointer.y * star.depth * 18;
        ctx.globalAlpha = star.opacity;
        ctx.fillStyle = "#fdf8e1";
        ctx.beginPath();
        ctx.arc(renderX, renderY, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    resize();
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", updatePointer);
      cancelAnimationFrame(animationFrameId);
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
