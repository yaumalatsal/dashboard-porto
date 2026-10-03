"use client";

import dynamic from "next/dynamic";

// WebGL only mounts client-side, same as the hero instrument.
const EmeraldOrrery3D = dynamic(() => import("@/components/three/EmeraldOrrery3D"), { ssr: false });

export default function OrreryLabPage() {
  return (
    <section className="orrery-lab" aria-labelledby="orrery-lab-title">
      <header className="orrery-lab__header">
        <p>3D experiment</p>
        <h1 id="orrery-lab-title">Gold Orrery</h1>
        <p className="orrery-lab__note">
          A 3D model with gold rings around a green sphere. Drag to rotate it.
        </p>
      </header>

      <div className="orrery-lab__stage">
        <EmeraldOrrery3D />
      </div>
    </section>
  );
}
