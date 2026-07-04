import React from "react";
import ConnecticutMap from "@/components/ConnecticutMap";

const GOLD = "#D4A030";

export default function ConnecticutSection() {
  return (
    <section className="py-24 px-6 bg-black border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-14 items-center">
        <div>
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>WHERE WE WORK</p>
          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">
            Connecticut Based.<br />Connecticut Proud.
          </h2>
          <p className="text-sm md:text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Founded in Waterbury, CT. Serving businesses from the corner store to the boardroom — from Waterbury to Greenwich.
          </p>
        </div>
        <ConnecticutMap />
      </div>
    </section>
  );
}
