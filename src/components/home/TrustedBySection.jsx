import React from "react";

const logos = [
  { name: "SUMMIT", sub: "FINANCIAL" },
  { name: "LUXE", sub: "REALTY" },
  { name: "PINNACLE", sub: "HEALTH" },
  { name: "MOMENTUM", sub: "SOLUTIONS" },
  { name: "BRIGHTLINE", sub: "AUTOMOTIVE" },
];

export default function TrustedBySection() {
  return (
    <section className="py-16 px-6 bg-background border-y border-border/50">
      <p className="text-center text-xs tracking-[0.25em] uppercase text-primary mb-10">
        TRUSTED BY GROWING BUSINESSES
      </p>
      <div className="max-w-5xl mx-auto flex flex-wrap justify-center items-center gap-10 md:gap-16">
        {logos.map((logo) => (
          <div key={logo.name} className="text-center">
            <p className="text-sm font-semibold tracking-wider text-muted-foreground">{logo.name}</p>
            <p className="text-[10px] tracking-[0.15em] text-muted-foreground/60 uppercase">{logo.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}