---
name: web-performance-accessibility
description: Standards for Lighthouse 90+ score, semantic HTML5, keyboard navigation, focus management, prefers-reduced-motion compliance, and PWA metadata.
---

# Web Performance & Accessibility Skill Guide

## Accessibility & SEO Rules
1. **Semantic HTML Structure**:
   - Single `<h1>` per page (Hero title).
   - Proper `<section>`, `<article>`, `<nav>`, `<footer>`, `<main>` tags.
   - Descriptive `aria-label` and `aria-hidden` attributes for decorative WebGL / SVG elements.

2. **Keyboard Navigation & Focus States**:
   - Skip to content link (`.skip-link`) at top of DOM.
   - Custom gold focus rings (`outline: 2px solid var(--ember); outline-offset: 4px`) on `:focus-visible`.

3. **Reduced Motion Fallback**:
   - Global `@media (prefers-reduced-motion: reduce)` rule overriding CSS animations/transitions.
   - React hooks (`useReducedMotion`) bypassing GSAP timelines and rendering static CSS 2D fallbacks instead of heavy 3D canvases.

4. **SEO & Meta**:
   - OpenGraph, Twitter Cards, PWA Manifest, and structured metadata.
