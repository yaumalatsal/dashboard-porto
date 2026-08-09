---
name: gsap-animation-choreography
description: Advanced GSAP, ScrollTrigger, Lenis smooth scrolling, pinned timelines, scrub choreography, and SplitText line/word reveal systems.
---

# GSAP Animation & Choreography Skill Guide

## Smooth Scroll & Timeline Sync
1. **Lenis + GSAP Integration**:
   - Sync Lenis scroll events directly with GSAP's ticker (`ScrollTrigger.update()`).
   - Disable CSS `scroll-behavior: smooth` on `html` so Lenis inertia scroll has full control without browser conflicts.

2. **Pinned Section Scrub Choreography**:
   - Pinned Hero Timeline (`scrub: 0.75`): Hero title scales up and translates out, canvas clip-path expands, orbit elements rotate, and transition divider sweeps across.
   - Pinned Works Chapter Portal (`scrub: 0.7`): 3D parallax depth cards shift and rotate with scroll progress.

3. **Text Reveal System**:
   - Clean DOM text split helpers without paid GSAP plugins.
   - Staggered line/word entrances (`stagger: 0.04-0.08`, `ease: "power3.out"`).

4. **GSAP Cleanup & React Context**:
   - Use `@gsap/react` `useGSAP` hook for proper animation cleanup, scoped refs, and dependency tracking.
   - Guard SSR and reduced-motion states strictly.
