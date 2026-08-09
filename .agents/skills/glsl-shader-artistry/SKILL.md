---
name: glsl-shader-artistry
description: Custom GLSL vertex and fragment shaders for procedural noise, holographic iridescence, fresnel glow, image displacement distortion, and particle shaders.
---

# GLSL Shader Artistry Skill Guide

## Shader Techniques for Awwwards Experiences
1. **Fresnel & Holographic Rim Glow**:
   ```glsl
   // Vertex Shader: Pass normal & view vector
   varying vec3 vNormal;
   varying vec3 vViewPosition;
   
   void main() {
     vNormal = normalize(normalMatrix * normal);
     vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
     vViewPosition = -mvPosition.xyz;
     gl_Position = projectionMatrix * mvPosition;
   }
   
   // Fragment Shader: Compute fresnel highlight
   varying vec3 vNormal;
   varying vec3 vViewPosition;
   uniform vec3 uBaseColor; // #B8860B (Burnished Gold)
   uniform vec3 uHoloColor; // #6B9FCC (Holographic Blue)
   
   void main() {
     vec3 normal = normalize(vNormal);
     vec3 viewDir = normalize(vViewPosition);
     float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
     vec3 finalColor = mix(uBaseColor, uHoloColor, fresnel * 0.7);
     gl_FragColor = vec4(finalColor, 1.0);
   }
   ```

2. **Dust Mote Particle Shaders**:
   - Alpha-fading edge attenuation with circular point rendering (`length(gl_PointCoord - vec2(0.5))`).
   - `THREE.NormalBlending` for visible particles on warm light backgrounds.

3. **Displacement Map Shader Effects**:
   - Mouse-driven UV distortion on project thumbnails using Simplex noise.
