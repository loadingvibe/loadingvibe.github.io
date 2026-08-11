"use client";

import GhostCursor from "./GhostCursor";

export default function GhostTitle({ id, text }) {
  return (
    <div className="records-ghost-title">
      <GhostCursor
        trailLength={58}
        inertia={0.64}
        grainIntensity={0.045}
        bloomStrength={0.18}
        bloomRadius={0.92}
        brightness={1.85}
        color="#ff681f"
        mixBlendMode="normal"
        edgeIntensity={0.04}
        fadeDelayMs={1100}
        fadeDurationMs={1800}
      />
      <h2 id={id}>{text}</h2>
    </div>
  );
}
