"use client";

import dynamic from "next/dynamic";

// WebGL only mounts client-side, same as the hero instrument.
const EmeraldOrrery3D = dynamic(() => import("@/components/three/EmeraldOrrery3D"), { ssr: false });

export default function OrreryLabPage() {
  return (
    <section className="orrery-lab" aria-labelledby="orrery-lab-title">
      <header className="orrery-lab__header">
        <p>Instrument Two</p>
        <h1 id="orrery-lab-title">The Gilt Orrery</h1>
        <p className="orrery-lab__note">
          A standing armillary in polished gold around a cut emerald core — a second instrument
          alongside the brass astrolabe on the field office.
        </p>
      </header>

      <div className="orrery-lab__stage">
        <EmeraldOrrery3D />
      </div>
    </section>
  );
}
