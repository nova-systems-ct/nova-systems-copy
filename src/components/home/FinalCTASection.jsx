import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 40%, #C8921A 60%, ${GOLD} 80%, #8a6200 100%)`;

export default function FinalCTASection() {
  return (
    <section className="py-24 px-6 bg-black border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-5">
          Ready to Find What's Holding Your Business Back?
        </h2>
        <p className="text-sm md:text-base mb-10 max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
          Start with the audit. We'll show you what needs attention and what to do next. Isaac personally reviews every request.
        </p>
        <Link
          to="/request-audit"
          className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
          style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
        >
          BOOK YOUR AUDIT <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
