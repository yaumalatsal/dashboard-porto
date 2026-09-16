"use client";

import { create } from "zustand";

export type AstrolabeSection =
  | "hero"
  | "about"
  | "work"
  | "skills"
  | "operations"
  | "experience"
  | "contact"
  | "pisces";

type PointerPosition = { x: number; y: number };

type UiState = {
  heroProgress: number;
  isLoaderComplete: boolean;
  isMenuOpen: boolean;
  activeSection: AstrolabeSection;
  focusedPoint: AstrolabeSection | null;
  /**
   * The chapter the pointer is resting on anywhere in the page. The navigation writes to
   * it so hovering "03 Field Kit" lights Mesarthim and swings the alidade onto it — that
   * pairing is what tells you the header and the instrument are one navigation.
   */
  hoveredPoint: AstrolabeSection | null;
  isTransitioning: boolean;
  pointer: PointerPosition;
  setHeroProgress: (progress: number) => void;
  setLoaderComplete: (isComplete: boolean) => void;
  setMenuOpen: (isOpen: boolean) => void;
  setActiveSection: (section: AstrolabeSection) => void;
  setFocusedPoint: (section: AstrolabeSection | null) => void;
  setHoveredPoint: (section: AstrolabeSection | null) => void;
  setTransitioning: (isTransitioning: boolean) => void;
  setPointer: (position: PointerPosition) => void;
};

export const useUiStore = create<UiState>((set) => ({
  heroProgress: 0,
  isLoaderComplete: false,
  isMenuOpen: false,
  activeSection: "hero",
  focusedPoint: null,
  hoveredPoint: null,
  isTransitioning: false,
  pointer: { x: 0, y: 0 },
  setHeroProgress: (heroProgress) => set({ heroProgress }),
  setLoaderComplete: (isLoaderComplete) => set({ isLoaderComplete }),
  setMenuOpen: (isMenuOpen) => set({ isMenuOpen }),
  setActiveSection: (activeSection) => set({ activeSection }),
  setFocusedPoint: (focusedPoint) => set({ focusedPoint }),
  setHoveredPoint: (hoveredPoint) => set({ hoveredPoint }),
  setTransitioning: (isTransitioning) => set({ isTransitioning }),
  setPointer: (pointer) => set({ pointer }),
}));
