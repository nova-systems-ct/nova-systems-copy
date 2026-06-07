import React from "react";
import { Activity, Wrench, Globe, Phone } from "lucide-react";

const GOLD = "#D4A030";

const services = [
  {
    icon: Activity,
    tag: "NOVA PULSE",
    title: "Revenue Leak Detection",
    desc: "Real-time monitoring of every call, lead, and follow-up. Nova Pulse tracks what your team misses and alerts you before revenue walks out the door.",
    stats: "Avg. 35% revenue recovery in 90 days",
  },
  {
    icon: Wrench,
    tag: "CUSTOM SYSTEMS",
    title: "Business Automation",
    desc: "We build the systems your business needs — CRM pipelines, automated follow-up sequences, booking integrations, and operational workflows tailored to how you work.",
    stats: "Save 15+ hours per week on manual tasks",
  },
  {
    icon: Globe,
    tag: "WEB INFRASTRUCTURE",
    title: "High-Converting Websites",
    desc: "Built for local businesses that need to dominate their market. Fast, mobile-first, SEO-optimized websites with embedded lead capture and call tracking.",
    stats: "2–4x more leads from existing traffic",
  },
  {
    icon: Phone,
    tag: "AI CALL HANDLING",
    title: "24/7 AI Call Response",
    desc: "Never miss another call. Our AI attendant answers, qualifies, and books appointments around the clock — then hands off to your team with full context.",
    stats: "Answer 100% of calls, even after hours",
  },
];

export default function SolutionSection() {
  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(212,160,48,0.05) 0%, transparent 65%)" }}
      />

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-14">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>
            WHAT WE DO
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-white">
            Operational infrastructure<br />for local businesses.
          </h2>
          <p className="mt-4 text-sm max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
            Nova Systems builds the revenue engine behind your business — from lead capture to customer conversion.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {services.map((s) => (
            <div
              key={s.tag}
              className="relative rounded-xl p-8 group transition-all duration-300 hover:scale-[1.015]"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="absolute top-0 left-0 w-10 h-10 pointer-events-none" style={{
                background: `linear-gradient(135deg, ${GOLD}30 0%, transparent 60%)`,
                borderTopLeftRadius: "12px",
              }} />

              <div className="flex items-start gap-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}
                >
                  <s.icon className="w-5 h-5" style={{ color: GOLD }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] tracking-[0.25em] uppercase font-bold mb-1" style={{ color: GOLD }}>
                    {s.tag}
                  </p>
                  <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.38)" }}>
                    {s.desc}
                  </p>
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}25` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GOLD }} />
                    <span className="text-[10px] font-semibold" style={{ color: GOLD }}>{s.stats}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
