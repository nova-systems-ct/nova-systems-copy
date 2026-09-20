import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Eye } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 40%, #C8921A 60%, ${GOLD} 80%, #8a6200 100%)`;

export default function AuditCTA() {
  return (
    <section className="py-28 px-6 bg-black relative overflow-hidden border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ width: 900, height: 500, background: `radial-gradient(ellipse, ${GOLD}10 0%, transparent 65%)` }}
      />
      <div className="max-w-3xl mx-auto text-center relative">
        <Eye className="w-9 h-9 mx-auto mb-7" style={{ color: GOLD }} />
        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">
          You Can't Fix What You Can't See.
        </h2>
        <p className="text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-11" style={{ color: "rgba(255,255,255,0.5)" }}>
          Nova Systems analyzes your business to identify where leads, customers, revenue and opportunities may be slipping through the cracks.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/request-audit"
            className="inline-flex items-center gap-2.5 px-9 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
          >
            Start Your Nova Audit <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/#process"
            className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.55)", padding: "16px 8px" }}
          >
            See How The Audit Works
          </Link>
        </div>
      </div>
    </section>
  );
}
