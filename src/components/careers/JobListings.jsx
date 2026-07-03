import React from "react";
import { Crown, TrendingUp, Camera, Globe, ArrowRight } from "lucide-react";
import { JOBS } from "./jobs";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const ICONS = {
  cto: Crown,
  coo: Crown,
  cpo: Crown,
  cfo: Crown,
  "sales-rep": TrendingUp,
  "content-creator": Camera,
  "lead-gen": Globe,
};

export default function JobListings({ onApply }) {
  return (
    <section className="py-16 md:py-24 px-6 bg-black">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-14">
          <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>OPEN ROLES</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">7 Positions Open</h2>
          <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Isaac reviews every application himself. Be real, be specific — that's what gets noticed.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {JOBS.map((job) => <JobCard key={job.id} job={job} onApply={onApply} />)}
        </div>

      </div>
    </section>
  );
}

function JobCard({ job, onApply }) {
  const Icon = ICONS[job.id] || Crown;
  return (
    <div className="rounded-2xl p-8 flex flex-col gap-6 transition-all duration-300 group"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(212,160,48,0.04)";
        e.currentTarget.style.borderColor = `${GOLD}50`;
        e.currentTarget.style.boxShadow = `0 8px 40px ${GOLD}10`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.boxShadow = "none";
      }}>

      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: `${GOLD}18`, border: `1px solid ${GOLD}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon className="w-5 h-5" style={{ color: GOLD }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30`, textAlign: "right" }}>
          {job.badge}
        </span>
      </div>

      {/* Title + teaser */}
      <div style={{ flex: 1 }}>
        <h3 className="text-white font-black text-xl leading-snug mb-3">{job.title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{job.teaser}</p>
      </div>

      {/* CTA */}
      <button onClick={() => onApply(job.id)}
        style={{ width: "100%", padding: "14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", borderRadius: 9, border: "none", cursor: "pointer", background: G, color: "#0a0800", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", transition: "opacity 0.15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
        APPLY NOW <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
