import React from "react";
import { Phone, Clock, Eye } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_DIM = "#D4A03022";

const problems = [
  {
    icon: Phone,
    title: "Leads vanish before you even know they called.",
    desc: "Every unanswered call is a customer choosing your competitor. Right now.",
  },
  {
    icon: Clock,
    title: "Slow follow-up is costing you deals daily.",
    desc: "The window to win is minutes — not hours. Most teams respond in hours.",
  },
  {
    icon: Eye,
    title: "You can't fix what you can't see.",
    desc: "Revenue is leaking from places your team has never looked. We find them.",
  },
];

export default function ProblemSection() {
  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden">
      {/* Subtle gold glow top-center */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${GOLD}18 0%, transparent 70%)` }}
      />

      <div className="max-w-4xl mx-auto text-center relative">
        <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>
          THE PROBLEM
        </p>
        <h2 className="text-4xl md:text-6xl font-black text-white leading-[0.95] tracking-tight">
          Revenue is walking<br />
          <span style={{
            background: `linear-gradient(90deg, ${GOLD} 0%, #F0C040 50%, ${GOLD} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>out your door.</span>
        </h2>
        <p className="text-white/40 mt-5 text-base max-w-lg mx-auto leading-relaxed">
          Every missed call. Every slow response. Every dropped lead.<br />
          Your competitors are taking what should be yours.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mt-14">
          {problems.map((p, i) => (
            <div
              key={p.title}
              className="relative rounded-xl p-7 text-left group transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: `1px solid rgba(255,255,255,0.07)`,
              }}
            >
              {/* Gold corner accent */}
              <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none" style={{
                background: `linear-gradient(135deg, ${GOLD}35 0%, transparent 60%)`,
                borderTopLeftRadius: "12px",
              }} />
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-5"
                style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}35` }}
              >
                <p.icon className="w-5 h-5" style={{ color: GOLD }} />
              </div>
              <h3 className="font-bold text-sm text-white leading-snug mb-2">{p.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}