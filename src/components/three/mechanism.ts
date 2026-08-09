import * as THREE from "three";

/**
 * The going train, as numbers rather than eyeballed animation rates.
 *
 * A ring gear on the mater drives four planet wheels and an escape wheel. Because the
 * mesh is rigid, every wheel's angle is *derived* from the ring's — nothing spins on its
 * own private timer. Compliance lives between the input shaft, the ring, and the cage,
 * which is what makes a drag look like force travelling through the mechanism.
 */

/**
 * Pitch radius of the ring gear cut into the mater face. Chosen so the ring body clears
 * the armillary cage (every point of which is ~3.12 from centre at most).
 */
export const RING_PITCH_RADIUS = 3.3;
/**
 * Pitch radius of each wheel that rides on it. Sized so a wheel's tooth tips stop at
 * ~3.92 — inside the mater's lip — instead of running out over the outer tooth ring.
 */
export const WHEEL_PITCH_RADIUS = 0.275;
/**
 * Front face the train sits on, proud of the mater so nothing occludes the mesh — and
 * high enough that the cage rings pass behind the gear teeth instead of through them.
 */
export const TRAIN_PLANE_Z = 0.54;
/** Wheels sit tangent to the ring, so their centres are one pitch sum out. */
export const WHEEL_ORBIT_RADIUS = RING_PITCH_RADIUS + WHEEL_PITCH_RADIUS;
export const WHEEL_TEETH = 8;
/** Same tooth pitch on both members is what makes the mesh read as real. */
export const RING_TEETH = Math.round(RING_PITCH_RADIUS / WHEEL_PITCH_RADIUS) * WHEEL_TEETH;
export const GEAR_RATIO = RING_PITCH_RADIUS / WHEEL_PITCH_RADIUS;

/** Visible-time analogue of sidereal rotation: one turn in roughly twelve minutes. */
export const SIDEREAL_RATE = (Math.PI * 2) / 720;
export const ORBIT_RATES = {
  equatorial: 1,
  ecliptic: -0.62,
  meridian: 1.7,
  hour: 0.3,
} as const;

/**
 * Wheel seats, in radians. Each must land on an exact ring-tooth boundary or the teeth
 * cannot interleave, so they are quantised to the ring's tooth pitch.
 */
export function seatAngle(index: number, count = 4): number {
  const toothPitch = (Math.PI * 2) / RING_TEETH;
  const raw = (Math.PI * 2 * index) / count + Math.PI / 4;
  return Math.round(raw / toothPitch) * toothPitch;
}

/** Seat for the escapement, at the bottom of the ring. */
export const ESCAPEMENT_SEAT = (() => {
  const toothPitch = (Math.PI * 2) / RING_TEETH;
  return Math.round((-Math.PI / 2) / toothPitch) * toothPitch;
})();

/**
 * A wheel's angle for a given ring angle. Derived from no-slip at the contact point:
 * the wheel counter-rotates at the pitch-radius ratio, and the constant term parks a
 * tooth valley against the ring tooth that sits at the seat when the ring is at zero.
 */
export function wheelAngle(ringAngle: number, seat: number): number {
  return -GEAR_RATIO * ringAngle + seat + Math.PI - Math.PI / WHEEL_TEETH;
}

/** Frame-rate independent approach — `smoothing` is the fraction remaining after one second. */
export function approach(current: number, target: number, smoothing: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.pow(smoothing, delta));
}

export type Transmission = {
  /** Ring-gear angle, radians. Lags the input shaft through the mainspring. */
  ring: number;
  /** Armillary cage angle, radians. Heaviest element, lags the ring. */
  cage: number;
  /** Smoothed shaft speed, for driving the escapement's beat. */
  speed: number;
  /** Free-running astronomical phase shared by every geared orbit. */
  orbitPhase: number;
  previousShaft: number;
};

export function createTransmission(): Transmission {
  return { ring: 0, cage: 0, speed: 0, orbitPhase: 0, previousShaft: 0 };
}

/**
 * Advances the train one frame. Each stage chases the one before it with its own
 * compliance, so a shove at the rim arrives at the cage a beat later.
 */
export function advanceTransmission(transmission: Transmission, shaftDegrees: number, delta: number): void {
  const shaft = THREE.MathUtils.degToRad(shaftDegrees) * -0.28;
  const step = Math.max(delta, 0.0001);

  const shaftSpeed = (shaftDegrees - transmission.previousShaft) / step;
  const shaftDelta = THREE.MathUtils.degToRad(shaftDegrees - transmission.previousShaft);
  transmission.previousShaft = shaftDegrees;
  transmission.speed = THREE.MathUtils.lerp(transmission.speed, shaftSpeed, 1 - Math.pow(0.02, step));

  transmission.ring = approach(transmission.ring, shaft, 0.0004, step);
  transmission.cage = approach(transmission.cage, transmission.ring * 0.3, 0.08, step);
  transmission.orbitPhase = THREE.MathUtils.euclideanModulo(
    transmission.orbitPhase + SIDEREAL_RATE * step + shaftDelta * 0.018,
    Math.PI * 2,
  );
}
