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
    <section className="py-24 px-6 bg-black">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase mb-5" style={{ color: GOLD }}>
          THE SOLUTION
        </p>
        <h2 className="text-3xl md:text-5xl font-bold text-white">NOVA Pulse</h2>
        <p className="text-white/45 mt-4 text-sm">
          See every leak. Fix every gap. Close every opportunity.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mt-16">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                style={{ border: `1px solid ${GOLD}40`, background: `${GOLD}10` }}
              >
                <f.icon className="w-6 h-6" style={{ color: GOLD }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: GOLD }}>{f.title}</h3>
              <p className="text-xs text-white/45 mt-2 leading-relaxed max-w-[160px]">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}