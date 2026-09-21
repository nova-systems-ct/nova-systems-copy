import React from "react";
import { Search, Stethoscope, Hammer, Activity, TrendingUp } from "lucide-react";

const GOLD = "#C9A84C";

const STEPS = [
  { n: "01", icon: Search, title: "Audit", desc: "Find what's leaking." },
  { n: "02", icon: Stethoscope, title: "Diagnose", desc: "Understand why." },
  { n: "03", icon: Hammer, title: "Build", desc: "Create the systems needed to fix it." },
  { n: "04", icon: Activity, title: "Operate", desc: "Run and monitor those systems." },
  { n: "05", icon: TrendingUp, title: "Optimize", desc: "Use real performance data to continuously improve." },
];

export default function ProcessSection() {
  return (
    <section id="process" className="py-24 px-6 bg-navy border-t scroll-mt-16" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>The Nova Process</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">From First Look to Ongoing Growth</h2>
        </div>

        <div className="grid md:grid-cols-5 gap-6 md:gap-4 relative">
          {/* connecting line, desktop only */}
          <div
            className="hidden md:block absolute top-7 left-[10%] right-[10%] h-px"
            style={{ background: `linear-gradient(to right, transparent, ${GOLD}55, ${GOLD}55, transparent)` }}
          />
          {STEPS.map(({ n, icon: Icon, title, desc }) => (
            <div key={n} className="relative text-center md:text-left">
              <div
                className="mx-auto md:mx-0 mb-5 relative z-10 flex items-center justify-center"
                style={{ width: 56, height: 56, borderRadius: "50%", background: "#0A0A0A", border: `1px solid ${GOLD}55` }}
              >
                <Icon className="w-5 h-5" style={{ color: GOLD }} />
              </div>
              <p className="text-xs font-bold mb-1" style={{ color: GOLD }}>{n}</p>
              <p className="text-base font-bold text-white mb-1.5">{title}</p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
