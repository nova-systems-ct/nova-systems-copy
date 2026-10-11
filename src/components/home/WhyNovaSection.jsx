import React from "react";
import { TrendingDown, Users, Clock, Target, Compass, Gauge } from "lucide-react";

const GOLD = "#C9A84C";

const LOSING = [
  { icon: Target, label: "Leads" },
  { icon: Users, label: "Customers" },
  { icon: TrendingDown, label: "Revenue" },
  { icon: Clock, label: "Time" },
  { icon: Compass, label: "Opportunities" },
  { icon: Gauge, label: "Operational Efficiency" },
];

export default function WhyNovaSection() {
  return (
    <section id="why-nova" className="py-24 px-6 bg-navy border-t scroll-mt-16" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>Why Nova</p>
        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-8">
          We Don't Start With Services.<br />We Start With What's Broken.
        </h2>
        <p className="text-sm md:text-base leading-relaxed max-w-2xl mx-auto mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
          Nova Systems does not begin by selling random services. We begin by identifying where a business is losing:
        </p>

        <div className="flex flex-wrap justify-center gap-3 my-9">
          {LOSING.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
              style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}35`, color: GOLD }}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </span>
          ))}
        </div>

        <p className="text-sm md:text-base leading-relaxed max-w-2xl mx-auto mb-14" style={{ color: "rgba(255,255,255,0.5)" }}>
          Then Nova builds the systems needed to solve those specific problems — not a generic package, a fix for what's actually broken.
        </p>

        <div className="flex items-center justify-center gap-4 md:gap-8">
          {["AUDIT", "BUILD", "GROW"].map((word, i) => (
            <React.Fragment key={word}>
              <span className="text-2xl md:text-4xl font-black" style={{ color: GOLD }}>{word}.</span>
              {i < 2 && <span className="w-6 md:w-10 h-px" style={{ background: `${GOLD}50` }} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
