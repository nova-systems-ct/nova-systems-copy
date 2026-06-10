import React from "react";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#F0C040";

export default function CareersHero() {
  return (
    <section className="relative py-28 md:py-40 px-6 overflow-hidden bg-black">
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,160,48,0.10) 0%, transparent 60%)" }}
      />
      {/* Gold top line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(to right, transparent 0%, ${GOLD} 30%, ${GOLD_BRIGHT} 50%, ${GOLD} 70%, transparent 100%)` }}
      />

      <div className="max-w-5xl mx-auto text-center relative">
        <p
          className="flex items-center justify-center gap-3 mb-6"
          style={{ color: GOLD, fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase" }}
        >
          NOVA SYSTEMS
          <span className="inline-block h-px w-10" style={{ background: `linear-gradient(to right, ${GOLD}, transparent)` }} />
          CAREERS
        </p>

        <h1
          className="font-black text-white leading-[0.9] mb-7"
          style={{ fontSize: "clamp(3.2rem, 7vw, 6.5rem)", letterSpacing: "-0.025em" }}
        >
          Build With Us.
        </h1>

        <p
          className="mx-auto leading-relaxed max-w-2xl"
          style={{ color: "rgba(255,255,255,0.5)", fontSize: "clamp(1rem, 1.3vw, 1.15rem)" }}
        >
          Nova Systems is growing. We're looking for hungry, talented people who want to be part of building something real in Connecticut.
        </p>

        <div className="flex items-center justify-center gap-6 mt-10">
          <div className="h-px flex-1 max-w-24" style={{ background: "rgba(255,255,255,0.08)" }} />
          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase" }}>
            2 OPEN · 2 FILLED
          </p>
          <div className="h-px flex-1 max-w-24" style={{ background: "rgba(255,255,255,0.08)" }} />
        </div>
      </div>
    </section>
  );
}