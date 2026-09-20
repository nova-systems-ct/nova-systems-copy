import React from "react";
import { Users, ShieldCheck, Wrench, Clock } from "lucide-react";

const GOLD = "#C9A84C";

// Configurable, not hardcoded inline — swap this array for real numeric stats (audits completed,
// revenue recovered, etc.) once Nova has real production volume to report. As of this build, the
// live audit/client tables have far too little real data (1 audit, 0 paying clients) to present
// as marketing stats without it reading as fabricated, so this uses true, verifiable claims
// instead of invented numbers — see NOVA_SYSTEMS_HOMEPAGE_REPORT for the reasoning.
const METRICS = [
  { icon: ShieldCheck, value: "100%", label: "Free, No-Obligation Audit" },
  { icon: Users, value: "1:1", label: "Personally Reviewed by Isaac" },
  { icon: Wrench, value: "Custom", label: "Built For Your Business, Not Templated" },
  { icon: Clock, value: "CT", label: "Based in Waterbury, Connecticut" },
];

export default function HeroMetrics() {
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {METRICS.map(({ icon: Icon, value, label }) => (
        <div key={label} className="flex items-center gap-2.5 px-4 py-4" style={{ background: "#04112B" }}>
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} />
          <div>
            <p className="text-sm font-black text-white leading-none">{value}</p>
            <p className="text-[10px] leading-snug mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
