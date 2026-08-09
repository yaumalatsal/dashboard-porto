---
name: awwwards-micro-interactions
description: Techniques for Awwwards SOTD micro-interactions, magnetic cursor tracking, image displacement shaders, tactile feedback, and interactive hover states.
---

# Awwwards Micro-Interactions Skill Guide

## Micro-Interaction Rules
1. **Custom Cursor Dynamics**:
   - Cursor morphing (`is-active` scaling, crosshair canvas mode, label reveals on `data-cursor="link"` and `data-cursor="project"`).
   - Dynamic blend modes (`mix-blend-mode: multiply` on warm parchment, contrast inversion on dark walnut sections).
   - Lerp follower dot (`gsap.quickTo`) with subtle spring inertia on the outer ring.

2. **Magnetic Pull Mechanics**:
   - `useMagnetic` hook applying spring lerp translate to interactive targets within a 50px activation threshold.
   - Elastic spring snapback on mouse leave (`ease: "elastic.out(1, 0.4)"`).

3. **Media & Image Hover Effects**:
   - Hover depth scaling and subtle noise overlay reveal (`clip-path` and contrast shift).
   - Image plane parallax offset on scroll (`yPercent` shifts).

4. **HUD & Ornamental Details**:
   - Rune corner ornaments (`::before`/`::after`) using burnished gold accents.
   - Line sweep animations (`transform: scaleX(1)`) on active navigation and links.
