import React from "react";
import { Link } from "react-router-dom";
import { Search, Bot, Phone, LayoutTemplate, Megaphone, BarChart3, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";

// Real destinations only — Wave One links to the actual product page (/waves); the rest point at
// /solutions (no dedicated per-service pages exist yet) rather than a "#" placeholder.
const SERVICES = [
  { icon: Search, title: "Revenue Audits", desc: "Find hidden leaks in your leads, calls, systems, and sales process.", to: "/request-audit" },
  { icon: Bot, title: "AI Automations", desc: "Automate follow-ups, booking, lead nurturing and internal operations with AI.", to: "/solutions" },
  { icon: Phone, title: "Wave One", desc: "Nova's communication system for calls, messages, and customer follow-up.", to: "/waves" },
  { icon: LayoutTemplate, title: "Websites & Funnels", desc: "High-converting digital experiences designed to turn attention into action.", to: "/solutions" },
  { icon: Megaphone, title: "Marketing Systems", desc: "Content, email, SMS, campaigns and automated lead-generation infrastructure.", to: "/solutions" },
  { icon: BarChart3, title: "Reports & Analytics", desc: "Real-time intelligence showing performance, leaks, and what to fix next.", to: "/solutions" },
];

export default function ServiceGrid() {
  return (
    <section id="services" className="py-24 px-6 bg-black border-t scroll-mt-16" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>What We Do</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-5">
            Full-Service Systems That Drive Growth
          </h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>From intelligence to implementation — we handle it all.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map(({ icon: Icon, title, desc, to }) => (
            <Link
              key={title}
              to={to}
              className="group rounded-2xl p-8 transition-all duration-200 block"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${GOLD}45`; e.currentTarget.style.background = `${GOLD}07`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 12, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}>
                <Icon style={{ width: 20, height: 20, color: GOLD }} />
              </div>
              <h3 className="text-white font-bold text-base mb-2.5 leading-snug">{title}</h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>{desc}</p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-transform group-hover:translate-x-1" style={{ color: GOLD }}>
                Learn More <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
