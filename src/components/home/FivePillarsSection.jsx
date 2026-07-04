import React from "react";
import { Link } from "react-router-dom";
import { Bot, Globe, Palette, Workflow, Compass, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const PILLARS = [
  {
    icon: Bot,
    title: "Custom AI Ecosystems",
    desc: "Automated phone agents, smart workflows, and AI systems that work for your business 24 hours a day.",
  },
  {
    icon: Globe,
    title: "High-End Web Development",
    desc: "Premium websites, client portals, booking systems, and custom web applications built to convert.",
  },
  {
    icon: Palette,
    title: "Enterprise Branding and Identity",
    desc: "Luxury visual design, business cards, storefront assets, corporate apparel, uniforms, and signage.",
  },
  {
    icon: Workflow,
    title: "Operational Automation",
    desc: "Lead tracking, CRM systems, business pipelines, digital contracts, and cloud infrastructure.",
  },
  {
    icon: Compass,
    title: "Technical Consulting and Strategy",
    desc: "End-to-end execution. If your business requires a technical solution, we design and deploy it.",
  },
];

export default function FivePillarsSection() {
  return (
    <section className="py-24 px-6 bg-black border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>WHAT WE BUILD</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-5">
            Everything Your Business Needs. One Partner.
          </h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>If your business needs it, we build it. Period.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PILLARS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-8 transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${GOLD}40`; e.currentTarget.style.background = `${GOLD}06`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}>
                <Icon style={{ width: 21, height: 21, color: GOLD }} />
              </div>
              <h3 className="text-white font-bold text-base mb-3 leading-snug">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-14">
          <Link
            to="/solutions"
            className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
          >
            SEE EVERYTHING WE DO <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
