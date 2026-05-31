import React from "react";
import { Activity, Bell, BarChart3, ShieldCheck } from "lucide-react";

const GOLD = "#D4A030";

const features = [
  {
    icon: Activity,
    title: "Real-time monitoring",
    desc: "Track leads, calls, and conversations as they happen.",
  },
  {
    icon: Bell,
    title: "Instant alerts",
    desc: "Get notified the moment an opportunity is at risk.",
  },
  {
    icon: BarChart3,
    title: "Performance insights",
    desc: "See what's working, what's not, and what to fix.",
  },
  {
    icon: ShieldCheck,
    title: "Recover lost revenue",
    desc: "Turn missed opportunities into new customers.",
  },
];

export default function SolutionSection() {
  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden">
      {/* Subtle gold glow center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(212,160,48,0.06) 0%, transparent 65%)" }}
      />

      <div className="max-w-5xl mx-auto text-center relative">
        <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>
          THE SOLUTION
        </p>
        <h2 className="text-4xl md:text-5xl font-black text-white">NOVA Pulse</h2>
        <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          See every leak. Fix every gap. Close every opportunity.
        </p>

        {/* Divider line */}
        <div className="flex items-center justify-center gap-3 mt-8 mb-14">
          <div className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${GOLD}60)` }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <div className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${GOLD}60)` }} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col items-center text-center rounded-xl p-6 transition-all duration-300 hover:scale-[1.03]"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                style={{ border: `1px solid ${GOLD}45`, background: `${GOLD}12` }}
              >
                <f.icon className="w-6 h-6" style={{ color: GOLD }} />
              </div>
              <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
              <p className="text-xs leading-relaxed max-w-[150px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}