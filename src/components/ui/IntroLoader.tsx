"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap-config";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useUiStore } from "@/stores/uiStore";
import { profile } from "@/data/portfolio";

const SESSION_KEY = "aether-intro-seen";

export default function IntroLoader() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const setLoaderComplete = useUiStore((state) => state.setLoaderComplete);

  useEffect(() => {
    const overlay = overlayRef.current;
    const root = document.documentElement;
    const hasPlayed = window.sessionStorage.getItem(SESSION_KEY) === "true";

    if (!overlay || hasPlayed || prefersReducedMotion) {
      root.classList.remove("is-intro-active");
      setVisible(false);
      setLoaderComplete(true);
      return;
    }

    root.classList.add("is-intro-active");
    let isFinished = false;

    const finish = () => {
      if (isFinished) {
        return;
      }
      isFinished = true;
      window.sessionStorage.setItem(SESSION_KEY, "true");
      root.classList.remove("is-intro-active");
      setLoaderComplete(true);
      setVisible(false);
    };

    const timeline = gsap.timeline({ onComplete: finish });
    timeline
      .fromTo("[data-loader-mark]", { scale: 0.72, opacity: 0, rotate: -18 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.55, ease: "power3.out" })
      .fromTo("[data-loader-name]", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45 }, "-=0.2")
      .to("[data-loader-mark]", { scale: 1.08, duration: 0.28, ease: "power2.inOut" })
      .to(overlay, { clipPath: "inset(0 0 100% 0)", duration: 0.65, ease: "power4.inOut" });

    const timeout = window.setTimeout(finish, 2800);
    return () => {
      window.clearTimeout(timeout);
      timeline.kill();
      root.classList.remove("is-intro-active");
    };
  }, [prefersReducedMotion, setLoaderComplete]);

  if (!visible) {
    return null;
  }

  return (
    <div className="intro-loader" ref={overlayRef} role="status" aria-label="Opening portfolio">
      <div className="intro-loader__mark" data-loader-mark aria-hidden="true">
        <span /><span /><span />
      </div>
      <p data-loader-name>{profile.name}</p>
      <span className="intro-loader__caption">Preparing the field guide</span>
    </div>
  );
}
