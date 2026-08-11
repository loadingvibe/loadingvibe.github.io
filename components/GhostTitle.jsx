"use client";

import GhostCursor from "./GhostCursor";

export default function GhostTitle({ id, text }) {
  return (
    <div className="records-ghost-title">
      <GhostCursor
        trailLength={42}
        inertia={0.58}
        grainIntensity={0.03}
        bloomStrength={0.06}
        bloomRadius={0.72}
        brightness={1.3}
        color="#329ed0"
        mixBlendMode="multiply"
        fadeDelayMs={900}
        fadeDurationMs={1500}
      />
      <h2 id={id}>{text}</h2>
    </div>
  );
}
