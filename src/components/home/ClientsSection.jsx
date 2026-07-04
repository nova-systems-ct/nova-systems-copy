import React from "react";

const GOLD = "#D4A030";

const CLIENTS = [
  "Flow Barbershop",
  "La Cazuela Restaurant",
  "Wepaa Graphics",
  "Mars Hill Apologetics",
  "Pola Market",
];

export default function ClientsSection() {
  return (
    <section className="py-20 px-6 bg-black border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>WHO WE SERVE</p>
        <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
          Real Connecticut Businesses. Real Results.
        </h2>
        <p className="text-sm max-w-md mx-auto mb-12" style={{ color: "rgba(255,255,255,0.4)" }}>
          Nova Systems deploys for real clients across Connecticut.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {CLIENTS.map((name) => (
            <div
              key={name}
              className="rounded-xl px-4 py-8 flex items-center justify-center text-center transition-all"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${GOLD}40`)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
            >
              <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>{name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
