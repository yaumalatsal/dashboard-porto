---
name: threejs-webgl-mastery
description: High-performance Three.js, React Three Fiber (R3F), GLSL Shaders, Drei helpers, particle systems, and light-background WebGL rendering techniques.
---

# Three.js & WebGL Mastery Skill Guide

## Key Principles for R3F on Light Backgrounds
1. **Material Blending Strategy**:
   - Never rely exclusively on additive blending (`THREE.AdditiveBlending`) on light/cream backgrounds, as it becomes invisible.
   - Use `THREE.NormalBlending` for particles and `MeshStandardMaterial` / `MeshPhysicalMaterial` with metalness (`0.85-0.95`) and roughness (`0.15-0.3`) for 3D geometry.
   - Combine Key Directional Light (warm `#FFFAF0`) and Fill Light (cool `#B8D4E8`) to create holographic rim highlights on metallic gold edges.

2. **Performance Monitoring & Degradation**:
   - Use Drei's `<PerformanceMonitor>` to automatically scale DPR (`[1, 1.5]` down to `1`) and adjust particle count on frame drops.
   - Implement low-tier mobile/touch fallbacks (`isCoarseOrCompact` / `prefersReducedMotion`) to avoid rendering WebGL on devices that cannot sustain 60fps.

3. **Interactivity & Motion**:
   - Smooth pointerlerp tracking for camera/mesh tilt.
   - ScrollTrigger progress syncing to rotate, scale, and transform geometry continuously with scroll position.
