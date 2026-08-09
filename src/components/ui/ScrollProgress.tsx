"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap-config";
import { useUiStore } from "@/stores/uiStore";

const chapters = [
  { id: "hero", label: "Orientation", number: "00" },
  { id: "about", label: "Practice", number: "01" },
  { id: "work", label: "Records", number: "02" },
  { id: "skills", label: "Field kit", number: "03" },
  { id: "contact", label: "Correspondence", number: "04" },
] as const;

const dialRadius = 27;
const dialCircumference = 2 * Math.PI * dialRadius;

export default function ScrollProgress() {
  const fillRef = useRef<SVGCircleElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [currentChapter, setCurrentChapter] = useState<(typeof chapters)[number]>(chapters[0]);
  const isLoaderComplete = useUiStore((state) => state.isLoaderComplete);

  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      gsap.set(fillRef.current, { strokeDashoffset: dialCircumference * (1 - progress) });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const chapter = chapters.find((item) => item.id === visible?.target.id);
        if (chapter) {
          setCurrentChapter(chapter);
        }
      },
      { rootMargin: "-38% 0px -46% 0px", threshold: [0, 0.15, 0.45] },
    );

    chapters.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isLoaderComplete || !frameRef.current) {
      return;
    }
    gsap.fromTo(
      frameRef.current.querySelectorAll(".journey-frame__edge"),
      { scaleX: 0, scaleY: 0 },
      { scaleX: 1, scaleY: 1, duration: 1.1, stagger: 0.08, ease: "power3.out" },
    );
  }, [isLoaderComplete]);

  return (
    <>
      <div className="journey-frame" ref={frameRef} aria-hidden="true">
        <span className="journey-frame__edge journey-frame__edge--top" />
        <span className="journey-frame__edge journey-frame__edge--right" />
        <span className="journey-frame__edge journey-frame__edge--bottom" />
        <span className="journey-frame__edge journey-frame__edge--left" />
        <span className="journey-frame__cross">+</span>
      </div>
      <div className="scroll-progress" aria-hidden="true">
        <span className="scroll-progress__dial">
          <svg viewBox="0 0 72 72">
            <circle className="scroll-progress__track" cx="36" cy="36" r={dialRadius} />
            <circle
              ref={fillRef}
              className="scroll-progress__fill"
              cx="36"
              cy="36"
              r={dialRadius}
              strokeDasharray={dialCircumference}
              strokeDashoffset={dialCircumference}
            />
          </svg>
          <i className="scroll-progress__axis scroll-progress__axis--x" />
          <i className="scroll-progress__axis scroll-progress__axis--y" />
          <span className="scroll-progress__label" key={currentChapter.id}>{currentChapter.number}</span>
        </span>
        <span className="scroll-progress__name" key={`${currentChapter.id}-name`}>{currentChapter.label}</span>
      </div>
    </>
  );
}
