import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

const GOLD = "#D4A030";

// No confirmed paying clients yet — do not list business names or logos here.
// Swap this for a real logo grid (see git history for the CLIENTS-array pattern)
// once there are verified clients willing to be named publicly.
export default function ClientsSection() {
  return (
    <section className="py-20 px-6 bg-black border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>Early Access</p>
        <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
          Now Onboarding Our First Clients
        </h2>
        <p className="text-sm max-w-md mx-auto mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          Nova Systems is early — which means founding clients get direct, hands-on attention instead of getting lost in a queue.
        </p>

        <div
          className="rounded-xl px-6 py-8 mb-10 flex flex-col items-center gap-3"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Sparkles className="w-5 h-5" style={{ color: GOLD }} />
          <p className="text-sm font-bold text-white">Be one of the first case studies.</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Client logos and results go here as real work ships.</p>
        </div>

        <Link
          to="/request-audit"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors hover:text-white"
          style={{ color: GOLD }}
        >
          Start Your Nova Audit <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}
