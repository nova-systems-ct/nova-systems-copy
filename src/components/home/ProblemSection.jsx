import React from "react";
import { Phone, Clock, Eye } from "lucide-react";

const GOLD = "#D4A030";

const problems = [
  {
    icon: Phone,
    title: "Leads go dark",
    desc: "Missed calls and forms never get followed up.",
  },
  {
    icon: Clock,
    title: "Slow responses",
    desc: "Delays in response time kill your chances.",
  },
  {
    icon: Eye,
    title: "No visibility",
    desc: "You can't fix what you can't see.",
  },
];

export default function ProblemSection() {
  return (
    <section className="py-24 px-6 bg-black">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase mb-5" style={{ color: GOLD }}>
          THE PROBLEM
        </p>
        <h2 className="text-3xl md:text-5xl font-bold text-white">
          Revenue slips through the cracks
        </h2>
        <p className="text-white/45 mt-4 text-sm max-w-md mx-auto leading-relaxed">
          Leads go unanswered. Follow-ups fall through.<br />
          And your team doesn't even know it's happening.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mt-14">
          {problems.map((p) => (
            <div
              key={p.title}
              className="border rounded-xl p-6 text-left"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <p.icon className="w-5 h-5 mb-4" style={{ color: GOLD }} />
              <h3 className="font-semibold text-sm text-white">{p.title}</h3>
              <p className="text-xs text-white/45 mt-2 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}