"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Shared vocabulary for the 2.5D-illustrated look, translated to real geometry:
 * flat banded toon shading, thick dark contours, a limited brass/amethyst palette.
 * Everything here survives a full 360 turn because the outlines are inverted hulls
 * rather than painted-on edges.
 */

export const palette = {
  outline: "#1b1218",
  caseBack: "#3a2a22",
  brassDeep: "#7a5223",
  brass: "#bd8734",
  brassLight: "#e3ba63",
  brassPale: "#f7e3a8",
  engrave: "#42291a",
  amethyst: "#6b398c",
  amethystLight: "#b174d6",
  /**
   * Purely ornamental gems — bearing jewels, wheel hubs, ring beads. Deliberately seated
   * *into* the brass rather than popping off it: a dozen bright amethyst dots read as a
   * dozen buttons, which is what made the six real star targets impossible to pick out.
   */
  jewel: "#553070",
  void: "#40216a",
  voidDeep: "#150a26",
  starCore: "#fff7db",
  starGold: "#f5d689",
} as const;

/** Three hard steps — the banding is what reads as "illustrated" rather than rendered. */
function buildToonRamp(): THREE.DataTexture {
  const steps = [0.42, 0.72, 1];
  const data = new Uint8Array(steps.length * 4);

  steps.forEach((step, index) => {
    const value = Math.round(step * 255);
    data.set([value, value, value, 255], index * 4);
  });

  const texture = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export const toonRamp = buildToonRamp();

const outlineCache = new Map<number, THREE.ShaderMaterial>();

/**
 * Inverted-hull contour. The offset happens in view space so an orthographic
 * camera keeps the line an even weight all the way around the silhouette.
 */
export function outlineMaterial(thickness: number): THREE.ShaderMaterial {
  const cached = outlineCache.get(thickness);
  if (cached) return cached;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(palette.outline) },
    },
    vertexShader: `
      uniform float uThickness;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        viewPosition.xyz += viewNormal * uThickness;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }
    `,
    side: THREE.BackSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  outlineCache.set(thickness, material);
  return material;
}

/** Flat brass band with real thickness — the workhorse for rings, hoops and limbs. */
export function bandGeometry(inner: number, outer: number, depth: number, segments = 96): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segments });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

export function discGeometry(radius: number, depth: number, segments = 96): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segments });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** Stamps one shape around a circle and merges it, so a 48-tooth ring stays a single draw call. */
export function radialMerge(
  base: THREE.BufferGeometry,
  count: number,
  radius: number,
  { startAngle = 0, z = 0 }: { startAngle?: number; z?: number } = {},
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const matrix = new THREE.Matrix4();

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + startAngle;
    const part = base.clone();
    matrix.makeRotationZ(angle);
    matrix.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    part.applyMatrix4(matrix);
    parts.push(part);
  }

  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((part) => part.dispose());
  base.dispose();
  return merged;
}

type Placement = {
  geometry: THREE.BufferGeometry;
  position?: [number, number, number];
  rotation?: [number, number, number];
};

/**
 * Bakes several parts that share one colour into a single geometry. Every part costs two
 * draw calls (fill plus contour), so collapsing a subsystem by material is the cheapest
 * way to keep the instrument's call count down without losing any of the detail.
 *
 * Consumes the geometries it is given.
 */
export function mergeParts(parts: Placement[]): THREE.BufferGeometry {
  const staged = parts.map(({ geometry, position, rotation }) => {
    // mergeGeometries refuses a mix of indexed and non-indexed inputs.
    const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (rotation) {
      clone.rotateX(rotation[0]);
      clone.rotateY(rotation[1]);
      clone.rotateZ(rotation[2]);
    }
    if (position) clone.translate(position[0], position[1], position[2]);
    return clone;
  });

  const merged = mergeGeometries(staged) as THREE.BufferGeometry;
  staged.forEach((geometry) => geometry.dispose());
  parts.forEach(({ geometry }) => geometry.dispose());
  return merged;
}

type GroupProps = React.ComponentProps<"group">;

type ToonPartProps = GroupProps & {
  geometry: THREE.BufferGeometry;
  color: string;
  outline?: number;
  emissive?: string;
  emissiveIntensity?: number;
};

/** A solid in the illustrated style: banded toon fill plus its dark contour. */
export function ToonPart({ geometry, color, outline = 0.028, emissive, emissiveIntensity = 1, ...props }: ToonPartProps) {
  return (
    <group {...props}>
      <mesh geometry={geometry}>
        <meshToonMaterial
          color={color}
          gradientMap={toonRamp}
          emissive={emissive ?? "#000000"}
          emissiveIntensity={emissive ? emissiveIntensity : 0}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      {outline > 0 && <mesh geometry={geometry} material={outlineMaterial(outline)} />}
    </group>
  );
}

/** Unlit flat colour — for glows, gems and anything that should ignore the lighting. */
export function FlatPart({
  geometry,
  color,
  outline = 0,
  opacity = 1,
  ...props
}: Omit<ToonPartProps, "emissive" | "emissiveIntensity"> & { opacity?: number }) {
  return (
    <group {...props}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      {outline > 0 && <mesh geometry={geometry} material={outlineMaterial(outline)} />}
    </group>
  );
}

/**
 * Builds the instrument's geometry once and releases it when the scene unmounts.
 * Entries may be null so a part can opt out of an optional detail (ticks, gems, …).
 */
export function useGeometryKit<T extends Record<string, THREE.BufferGeometry | null>>(build: () => T): T {
  const [kit] = useState(build);

  useEffect(() => () => Object.values(kit).forEach((geometry) => geometry?.dispose()), [kit]);

  return kit;
}
