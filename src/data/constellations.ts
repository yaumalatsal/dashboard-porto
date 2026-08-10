export type CelestialStar = {
  key: string;
  name: string;
  designation: string;
  /** Right ascension in decimal hours, J2000. */
  ra: number;
  /** Declination in decimal degrees, J2000. */
  dec: number;
  /** Apparent visual magnitude. Lower values are brighter. */
  magnitude: number;
};

export type Constellation = {
  id: "aries" | "pisces";
  stars: readonly CelestialStar[];
  /** Independent line segments preserve the actual figure topology. */
  segments: readonly (readonly [string, string])[];
};

export type ConstellationId = Constellation["id"];

/** Identifies the map page without replacing the underlying catalog coordinates. */
export function constellationIdForStar(star: Pick<CelestialStar, "key">): ConstellationId {
  return star.key === "alrescha" || star.key.endsWith("-psc") ? "pisces" : "aries";
}

/**
 * Catalog coordinates describe the real sky, where Aries is a very compact figure.
 * The instrument uses an expanded display projection so each constellation can fill
 * the reading aperture as its own map page while retaining its genuine topology.
 */
export function celestialMapCoordinates(
  star: Pick<CelestialStar, "key" | "ra" | "dec">,
): { longitude: number; latitude: number } {
  const constellation = constellationIdForStar(star);
  const ariesDisplay: Record<string, { longitude: number; latitude: number }> = {
    bharani: { longitude: 45, latitude: 25 },
    botein: { longitude: 35, latitude: 0 },
    hamal: { longitude: 0, latitude: 14 },
    sheratan: { longitude: -22, latitude: 0 },
    mesarthim: { longitude: -45, latitude: -16 },
  };
  if (constellation === "aries") return ariesDisplay[star.key] ?? { longitude: 0, latitude: 0 };

  // Hand-tuned display map for Pisces — same approach as Aries.
  // The western fish loop (Gamma → Kappa → Lambda → 19 → Iota → Theta → 7 → Gamma)
  // occupies the left/lower quadrant; the cord (Gamma → Omega → … → Alrescha) sweeps
  // diagonally through centre; the northern fish branch (Alrescha → … → Rho) rises
  // toward the upper-right.
  const piscesDisplay: Record<string, { longitude: number; latitude: number }> = {
    // ── Western fish loop ──
    "gamma-psc":   { longitude: -42, latitude: -18 },
    "kappa-psc":   { longitude: -50, latitude: -32 },
    "lambda-psc":  { longitude: -38, latitude: -42 },
    "nineteen-psc":{ longitude: -22, latitude: -38 },
    "iota-psc":    { longitude: -14, latitude: -26 },
    "theta-psc":   { longitude: -24, latitude: -14 },
    "seven-psc":   { longitude: -34, latitude: -8 },
    // ── Cord connecting the two fish ──
    "omega-psc":   { longitude: -28, latitude:  2 },
    "delta-psc":   { longitude: -12, latitude:  12 },
    "epsilon-psc": { longitude:  0,  latitude:  16 },
    "mu-psc":      { longitude:  12, latitude:  12 },
    "nu-psc":      { longitude:  22, latitude:  6 },
    "xi-psc":      { longitude:  32, latitude:  0 },
    "alrescha":    { longitude:  40, latitude: -6 },
    // ── Northern fish branch ──
    "omicron-psc": { longitude:  34, latitude:  14 },
    "pi-psc":      { longitude:  38, latitude:  26 },
    "eta-psc":     { longitude:  44, latitude:  38 },
    "rho-psc":     { longitude:  50, latitude:  48 },
  };
  if (constellation === "pisces") return piscesDisplay[star.key] ?? { longitude: 0, latitude: 0 };

  // Fallback for any unmapped star
  return { longitude: 0, latitude: 0 };
}

export const ariesConstellation: Constellation = {
  id: "aries",
  stars: [
    { key: "bharani", name: "Bharani", designation: "41 Ari", ra: 2.8331, dec: 27.2605, magnitude: 3.61 },
    { key: "botein", name: "Botein", designation: "Delta Ari", ra: 3.1938, dec: 19.7267, magnitude: 4.35 },
    { key: "hamal", name: "Hamal", designation: "Alpha Ari", ra: 2.1196, dec: 23.4624, magnitude: 2.0 },
    { key: "sheratan", name: "Sheratan", designation: "Beta Ari", ra: 1.9107, dec: 20.808, magnitude: 2.64 },
    { key: "mesarthim", name: "Mesarthim", designation: "Gamma Ari", ra: 1.8922, dec: 19.2939, magnitude: 3.88 },
  ],
  segments: [
    ["bharani", "botein"],
    ["botein", "hamal"],
    ["hamal", "sheratan"],
    ["sheratan", "mesarthim"],
  ],
};

export const piscesConstellation: Constellation = {
  id: "pisces",
  stars: [
    { key: "alrescha", name: "Alrescha", designation: "Alpha Psc", ra: 2.0341, dec: 2.7636, magnitude: 3.82 },
    { key: "xi-psc", name: "Xi Piscium", designation: "Xi Psc", ra: 1.8926, dec: 3.1875, magnitude: 4.62 },
    { key: "nu-psc", name: "Nu Piscium", designation: "Nu Psc", ra: 1.6905, dec: 5.4876, magnitude: 4.44 },
    { key: "mu-psc", name: "Mu Piscium", designation: "Mu Psc", ra: 1.5031, dec: 6.1438, magnitude: 4.84 },
    { key: "epsilon-psc", name: "Epsilon Piscium", designation: "Epsilon Psc", ra: 1.0491, dec: 7.89, magnitude: 4.28 },
    { key: "delta-psc", name: "Delta Piscium", designation: "Delta Psc", ra: 0.8114, dec: 7.5851, magnitude: 4.43 },
    { key: "omega-psc", name: "Omega Piscium", designation: "Omega Psc", ra: 23.9885, dec: 6.8633, magnitude: 4.03 },
    { key: "gamma-psc", name: "Gamma Piscium", designation: "Gamma Psc", ra: 23.2859, dec: 3.2823, magnitude: 3.7 },
    { key: "seven-psc", name: "7 Piscium", designation: "7 Psc", ra: 23.339, dec: 5.3813, magnitude: 5.05 },
    { key: "theta-psc", name: "Theta Piscium", designation: "Theta Psc", ra: 23.4661, dec: 6.379, magnitude: 4.27 },
    { key: "iota-psc", name: "Iota Piscium", designation: "Iota Psc", ra: 23.6658, dec: 5.6263, magnitude: 4.13 },
    { key: "nineteen-psc", name: "19 Piscium", designation: "19 Psc", ra: 23.7732, dec: 3.4868, magnitude: 5.0 },
    { key: "lambda-psc", name: "Lambda Piscium", designation: "Lambda Psc", ra: 23.7008, dec: 1.7801, magnitude: 4.5 },
    { key: "kappa-psc", name: "Kappa Piscium", designation: "Kappa Psc", ra: 23.4489, dec: 1.2558, magnitude: 4.94 },
    { key: "omicron-psc", name: "Omicron Piscium", designation: "Omicron Psc", ra: 1.7566, dec: 9.1577, magnitude: 4.26 },
    { key: "pi-psc", name: "Pi Piscium", designation: "Pi Psc", ra: 1.6183, dec: 12.1415, magnitude: 5.57 },
    { key: "eta-psc", name: "Kullat Nunu", designation: "Eta Psc", ra: 1.5247, dec: 15.3458, magnitude: 3.62 },
    { key: "rho-psc", name: "Rho Piscium", designation: "Rho Psc", ra: 1.4376, dec: 19.1723, magnitude: 5.38 },
  ],
  segments: [
    ["alrescha", "xi-psc"],
    ["xi-psc", "nu-psc"],
    ["nu-psc", "mu-psc"],
    ["mu-psc", "epsilon-psc"],
    ["epsilon-psc", "delta-psc"],
    ["delta-psc", "omega-psc"],
    ["omega-psc", "gamma-psc"],
    ["gamma-psc", "seven-psc"],
    ["seven-psc", "theta-psc"],
    ["theta-psc", "iota-psc"],
    ["iota-psc", "nineteen-psc"],
    ["nineteen-psc", "lambda-psc"],
    ["lambda-psc", "kappa-psc"],
    ["kappa-psc", "gamma-psc"],
    ["alrescha", "omicron-psc"],
    ["omicron-psc", "pi-psc"],
    ["pi-psc", "eta-psc"],
    ["eta-psc", "rho-psc"],
  ],
};

const catalog = new Map(
  [...ariesConstellation.stars, ...piscesConstellation.stars].map((star) => [star.key, star]),
);

export function celestialStar(key: string): CelestialStar {
  const star = catalog.get(key);
  if (!star) throw new Error(`Unknown celestial star: ${key}`);
  return star;
}

export function starScale(magnitude: number): number {
  return Math.max(0.58, Math.min(1.22, 1.38 - magnitude * 0.15));
}
