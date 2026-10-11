import React from "react";
import { Link } from "react-router-dom";
import { Mic, MessageSquare, Mail, Share2, RefreshCcw, ClipboardCheck, ArrowRight } from "lucide-react";

const GOLD = "#C9A84C";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6b2a 0%, ${GOLD} 40%, #E0C476 60%, ${GOLD} 80%, #8a6b2a 100%)`;

// Same six engines named on /waves — kept consistent with that page rather than inventing new
// capability claims here (see src/pages/Waves.jsx ENGINES).
const NODES = [
  { icon: Mic, label: "Voice", angle: -90 },
  { icon: MessageSquare, label: "Blue (SMS)", angle: -30 },
  { icon: Mail, label: "Email", angle: 30 },
  { icon: Share2, label: "Social", angle: 90 },
  { icon: RefreshCcw, label: "Revive", angle: 150 },
  { icon: ClipboardCheck, label: "Audit", angle: 210 },
];

export default function WaveOneFeature() {
  return (
    <section className="py-24 px-6 relative overflow-hidden border-t" style={{ background: "#0a0800", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 70% 50%, ${GOLD}0f 0%, transparent 60%)` }} />
      <div className="max-w-6xl mx-auto relative grid lg:grid-cols-2 gap-14 items-center">
        {/* Node diagram */}
        <div className="relative mx-auto" style={{ width: 340, height: 340 }}>
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${GOLD}30` }}
          />
          <div
            className="absolute rounded-full flex items-center justify-center"
            style={{ inset: "38%", background: `${GOLD}12`, border: `1px solid ${GOLD}55` }}
          >
            <span className="text-xs font-black text-center leading-tight" style={{ color: GOLD }}>WAVE<br />ONE</span>
          </div>
          {NODES.map(({ icon: Icon, label, angle }) => {
            const rad = (angle * Math.PI) / 180;
            const r = 150;
            const x = 170 + r * Math.cos(rad);
            const y = 170 + r * Math.sin(rad);
            return (
              <div key={label} className="absolute flex flex-col items-center gap-1.5" style={{ left: x - 26, top: y - 26 }}>
                <div
                  className="w-[52px] h-[52px] rounded-full flex items-center justify-center"
                  style={{ background: "#0A0A0A", border: `1px solid ${GOLD}45` }}
                >
                  <Icon className="w-4 h-4" style={{ color: GOLD }} />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
              </div>
            );
          })}
          <svg className="absolute inset-0" width="340" height="340" style={{ pointerEvents: "none" }}>
            {NODES.map(({ angle, label }) => {
              const rad = (angle * Math.PI) / 180;
              const r = 150;
              const x = 170 + r * Math.cos(rad);
              const y = 170 + r * Math.sin(rad);
              return <line key={label} x1="170" y1="170" x2={x} y2={y} stroke={`${GOLD}25`} strokeWidth="1" />;
            })}
          </svg>
        </div>

        {/* Copy */}
        <div>
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>Communication Layer</p>
          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">Wave One</h2>
          <p className="text-sm md:text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
            Nova's intelligent communication layer — one system to manage and respond across every customer channel: calls, texts, email, social DMs, and dormant leads.
          </p>
          <Link
            to="/waves"
            className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
          >
            Explore Wave One <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
