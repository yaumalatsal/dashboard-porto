"use client";

import { useEffect, type ReactNode } from "react";
import { useUiStore, type AstrolabeSection } from "@/stores/uiStore";

const sectionToHash: Record<AstrolabeSection, string> = {
  hero: "",
  about: "#about",
  work: "#work",
  skills: "#skills",
  experience: "#experience",
  contact: "#contact",
  pisces: "#pisces",
};

const hashToSection: Record<string, AstrolabeSection> = {
  "": "hero",
  "#hero": "hero",
  "#about": "about",
  "#work": "work",
  "#skills": "skills",
  "#experience": "experience",
  "#contact": "contact",
  "#pisces": "pisces",
};

export default function AstrolabeNavigator({ children }: { children: ReactNode }) {
  const activeSection = useUiStore((state) => state.activeSection);
  const setActiveSection = useUiStore((state) => state.setActiveSection);
  const setFocusedPoint = useUiStore((state) => state.setFocusedPoint);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const matched = hashToSection[hash];
      if (matched) {
        setActiveSection(matched);
        setFocusedPoint(matched === "hero" ? null : matched);
      }
    };

    handleHashChange();
    window.addEventListener("popstate", handleHashChange);
    return () => window.removeEventListener("popstate", handleHashChange);
  }, [setActiveSection, setFocusedPoint]);

  useEffect(() => {
    const targetHash = sectionToHash[activeSection];
    const currentHash = window.location.hash;

    if (targetHash !== currentHash) {
      if (targetHash === "") {
        window.history.replaceState(null, "", window.location.pathname);
      } else {
        window.history.replaceState(null, "", targetHash);
      }
    }
  }, [activeSection]);

  return (
    <div className="astrolabe-navigator" id="main-content">
      {children}
    </div>
  );
}
