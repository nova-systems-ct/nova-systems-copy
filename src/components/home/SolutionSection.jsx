import React from "react";
import { Link } from "react-router-dom";
import { Activity, Wrench, Globe, Phone } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const services = [
  {
    icon: Activity,
    tag: "NOVA PULSE",
    title: "Revenue Leak Detection",
    desc: "Real-time tracking of every call, lead, and follow-up - with instant alerts before revenue walks out the door.",
    stat: "35%",
    statLabel: "avg revenue recovered in 90 days",
  },
  {
    icon: Wrench,
    tag: "CUSTOM SYSTEMS",
    title: "Business Automation",
    desc: "Custom CRM pipelines and automated follow-up built around how your business actually works - not a template.",
    stat: "15+",
    statLabel: "hours saved per week",
  },
  {
    icon: Globe,
    tag: "WEB INFRASTRUCTURE",
    title: "High-Converting Websites",
    desc: "Fast, mobile-first sites with lead capture, call tracking, and local SEO built in from day one.",
    stat: "4x",
    statLabel: "more leads from existing traffic",
  },
  {
    icon: Phone,
    tag: "AI CALL HANDLING",
    title: "24/7 AI Call Response",
    desc: "Our AI answers, qualifies, and books appointments around the clock - then hands off to your team with full context.",
    stat: "100%",
    statLabel: "of calls answered, even after hours",
  },
];

function FlipCard({ service }) {
  const Icon = service.icon;
  return (
    <div className="flip-card">
      <div className="flip-card-inner">
        <div
          className="flip-card-face"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: 28,
            display: "flex", flexDirection: "column", justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${GOLD}12`, border: `1px solid ${GOLD}35`,
            }}>
              <Icon style={{ width: 20, height: 20, color: GOLD }} />
            </div>
            <div>
              <p style={{ fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", fontWeight: 700, color: GOLD, margin: 0 }}>{service.tag}</p>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "3px 0 0" }}>{service.title}</h3>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 38, fontWeight: 900, color: GOLD, lineHeight: 1, margin: 0 }}>{service.stat}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>{service.statLabel}</p>
            </div>
            <p style={{ fontSize: 9, letterSpacing: "0.08em", color: "rgba(255,255,255,0.18)" }}>hover to explore →</p>
          </div>
        </div>

        <div
          className="flip-card-face flip-card-back"
          style={{
            background: `${GOLD}10`, border: `1px solid ${GOLD}40`,
            borderRadius: 12, padding: 28,
            display: "flex", flexDirection: "column", justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", fontWeight: 700, color: GOLD, marginBottom: 14 }}>{service.tag}</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.65 }}>{service.desc}</p>
          </div>
          <Link
            to="/solutions"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
              padding: "10px 18px", background: GOLD_GRADIENT, color: "#0a0800",
              textDecoration: "none", alignSelf: "flex-start",
            }}
          >
            LEARN MORE →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SolutionSection() {
  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(212,160,48,0.05) 0%, transparent 65%)" }}
      />
      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-14">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>WHAT WE DO</p>
          <h2 className="text-4xl md:text-5xl font-black text-white">
            Four systems.<br />One goal: more revenue.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {services.map((s) => <FlipCard key={s.tag} service={s} />)}
        </div>
      </div>

      <style>{`
        .flip-card { perspective: 1000px; height: 210px; }
        .flip-card-inner {
          position: relative; width: 100%; height: 100%;
          transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }
        .flip-card:hover .flip-card-inner { transform: rotateY(180deg); }
        .flip-card-face {
          position: absolute; inset: 0;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        .flip-card-back { transform: rotateY(180deg); }
      `}</style>
    </section>
  );
}
