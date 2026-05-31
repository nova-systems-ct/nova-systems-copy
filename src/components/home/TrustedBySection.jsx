import React from "react";

const GOLD = "#D4A030";

const logos = [
  { name: "SUMMIT", sub: "FINANCIAL" },
  { name: "LUXE", sub: "REALTY" },
  { name: "PINNACLE", sub: "HEALTH" },
  { name: "MOMENTUM", sub: "SOLUTIONS" },
  { name: "BRIGHTLINE", sub: "AUTOMOTIVE" },
];

export default function TrustedBySection() {
  return (
    <section className="py-14 px-6 bg-black border-y border-white/8">
      <p className="text-center text-[10px] tracking-[0.3em] uppercase mb-10" style={{ color: GOLD }}>
        TRUSTED BY GROWING BUSINESSES
      </p>
      <div className="max-w-5xl mx-auto flex flex-wrap justify-center items-center gap-12 md:gap-20">
        {logos.map((logo) => (
          <div key={logo.name} className="text-center">
            <p className="text-sm font-bold tracking-[0.18em] text-white/50">{logo.name}</p>
            <p className="text-[9px] tracking-[0.18em] text-white/25 uppercase mt-0.5">{logo.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}