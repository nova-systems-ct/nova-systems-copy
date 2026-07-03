import React from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, FileCheck2, MessageSquare, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const FEATURES = [
  { icon: LayoutDashboard, title: "Track Services", desc: "See every deliverable, campaign, and update in one live dashboard." },
  { icon: FileCheck2,      title: "Approve Content", desc: "Review and approve social posts, designs, and copy before they go live." },
  { icon: MessageSquare,   title: "Message Your Team", desc: "Direct line to Nova Systems — pay invoices and get answers, fast." },
];

export default function NovaConnectSection() {
  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(212,160,48,0.06) 0%, transparent 65%)" }} />
      <div className="max-w-5xl mx-auto relative text-center">
        <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>CLIENT PORTAL</p>
        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">
          Introducing <span style={{ color: GOLD }}>Nova Connect</span>
        </h2>
        <p className="text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-16" style={{ color: "rgba(255,255,255,0.45)" }}>
          Your dedicated client portal. Track services, approve content, pay invoices, message your team. All in one place.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-14">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="mx-auto mb-6" style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: `${GOLD}15`, border: `1px solid ${GOLD}40` }}>
                <Icon style={{ width: 22, height: 22, color: GOLD }} />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{desc}</p>
            </div>
          ))}
        </div>

        <Link to="/login" className="inline-flex items-center gap-2 text-xs font-bold tracking-wider uppercase px-8 py-4 rounded-lg hover:opacity-85 transition-all" style={{ background: G, color: "#0a0800" }}>
          CLIENT LOGIN <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
