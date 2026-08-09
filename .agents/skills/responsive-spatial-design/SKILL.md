---
name: responsive-spatial-design
description: Adaptive spatial layouts, mobile WebGL fallbacks, touch gesture physics, breakpoint scale systems, and cross-device performance optimization.
---

# Responsive Spatial Design Skill Guide

## Cross-Device Spatial Adaptations
1. **Desktop Tier (>= 768px)**:
   - Full R3F WebGL Hero canvas with orbital particle systems, lighting effects, and scroll-pinned GSAP choreography.
   - Dual-layer depth cards in Works section with 3D perspective transforms (`perspective: 1400px`).
   - Active magnetic custom cursor tracking.

2. **Compact & Touch Tier (< 768px / Touch)**:
   - WebGL Canvas replaced seamlessly by lightweight CSS animated relic fallback (`.relic-fallback`) to preserve 60fps and battery life.
   - Pinned scrub timelines unpinned into normal fluid block flows.
   - Custom cursor hidden automatically via `(hover: hover) and (pointer: fine)` media query guard.

3. **Fluid Typography & Spacing Scale**:
   - `clamp()` responsive fluid typography (`--font-size-display: clamp(3rem, 8vw, 7rem)`).
   - Responsive page paddings (`var(--page-pad): max(1.25rem, 5vw)`).
