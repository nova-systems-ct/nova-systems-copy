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
    <section className="py-8 px-6 bg-black border-b border-white/8">
      <p className="text-center text-[9px] tracking-[0.35em] uppercase mb-6" style={{ color: GOLD }}>
        TRUSTED BY GROWING BUSINESSES
      </p>
      <div className="max-w-4xl mx-auto flex flex-wrap justify-center items-center gap-8 md:gap-14">
        {logos.map((logo) => (
          <div key={logo.name} className="text-center group">
            {/* Gold dot accent */}
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <span className="block w-1 h-1 rounded-full" style={{ background: GOLD, opacity: 0.5 }} />
              <p className="text-xs font-bold tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>{logo.name}</p>
              <span className="block w-1 h-1 rounded-full" style={{ background: GOLD, opacity: 0.5 }} />
            </div>
            <p className="text-[8px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>{logo.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}