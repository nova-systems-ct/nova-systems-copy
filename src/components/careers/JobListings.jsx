import React from "react";
import { Camera, TrendingUp, Code, Users, MapPin, Clock, DollarSign, ArrowRight, Wind } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const OPEN_JOBS = [
  {
    id: "videographer",
    title: "Videographer / Content Creator",
    icon: Camera,
    type: "Part-Time · Per Project",
    pay: "$20/hr · $200 biweekly",
    location: "Waterbury, CT",
    tag: "CONTENT",
    description:
      "We need a videographer who can make local businesses look elite. You'll film at client locations — barbershops, restaurants, retail stores — capturing content that stops the scroll.",
    requirements: [
      "Must own camera or 1080p+ capable phone",
      "Video editing required (CapCut, Premiere, or DaVinci)",
      "Portfolio of previous work required",
      "Reliable transportation",
    ],
    highlight: "Drone experience is a major plus — prioritized",
  },
  {
    id: "sales",
    title: "Sales Representative",
    icon: TrendingUp,
    type: "Commission Only",
    pay: "10% per deal closed",
    location: "Waterbury, CT",
    tag: "SALES",
    description:
      "Represent Nova Systems in the field. Walk into local businesses, pitch our services, book meetings for Isaac. You eat what you kill. No cap on earnings.",
    requirements: [
      "Confident, presentable, well-spoken",
      "Reliable transportation required",
      "Hustle mentality — self-motivated",
    ],
    bonus: "No cap on earnings",
  },
  {
    id: "drone-operator",
    title: "Drone Operator & Aerial Cinematographer",
    icon: Wind,
    type: "Per Project",
    pay: "$25–50/hour · per project",
    location: "Waterbury, CT area",
    tag: "AERIAL",
    description:
      "Capture aerial footage for client websites and social media. Film local businesses, events, and locations across Waterbury and CT. Your shots will be the headline content.",
    requirements: [
      "Must own a professional drone (DJI preferred)",
      "FAA Part 107 license preferred",
      "Portfolio of aerial footage required",
      "Video editing experience preferred",
    ],
    highlight: "FAA Part 107 certified pilots prioritized",
  },
];

const FILLED_JOBS = [
  { id: "web-dev",        title: "Web Developer",  icon: Code,  type: "Part-Time" },
  { id: "brand-ambassador", title: "Brand Ambassador", icon: Users, type: "Part-Time" },
];

export default function JobListings({ onApply }) {
  return (
    <section className="py-16 md:py-24 px-6 bg-black">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-14">
          <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>OPEN ROLES</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">3 Positions Open</h2>
          <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Isaac reviews every application himself. Be real, be specific — that's what gets noticed.
          </p>
        </div>

        {/* Open positions grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {OPEN_JOBS.map((job) => <OpenCard key={job.id} job={job} onApply={onApply} />)}
        </div>

        {/* Filled positions */}
        <div>
          <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 14 }}>FILLED POSITIONS</p>
          <div className="grid md:grid-cols-2 gap-4">
            {FILLED_JOBS.map((job) => <FilledCard key={job.id} job={job} />)}
          </div>
        </div>

      </div>
    </section>
  );
}

function OpenCard({ job, onApply }) {
  const Icon = job.icon;
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: `${GOLD}18`, border: `1px solid ${GOLD}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon className="w-5 h-5" style={{ color: GOLD }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
          {job.tag}
        </span>
      </div>

      {/* Title + description */}
      <div>
        <h3 className="text-white font-black text-xl leading-snug mb-3">{job.title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{job.description}</p>
      </div>

      {/* Meta tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <MetaTag icon={Clock} label={job.type} />
        <MetaTag icon={DollarSign} label={job.pay} />
        <MetaTag icon={MapPin} label={job.location} />
      </div>

      {/* Requirements */}
      {job.requirements && (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {job.requirements.map((req, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: GOLD, flexShrink: 0, marginTop: 6 }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{req}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Highlight */}
      {job.highlight && (
        <div style={{ padding: "10px 16px", borderRadius: 8, background: `${GOLD}10`, border: `1px solid ${GOLD}25`, textAlign: "center" }}>
          <p style={{ color: GOLD, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>★ {job.highlight}</p>
        </div>
      )}
      {job.bonus && (
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>+ {job.bonus}</p>
      )}

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

function FilledCard({ job }) {
  const Icon = job.icon;
  return (
    <div style={{ padding: "22px 24px", borderRadius: 14, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 14, opacity: 0.45 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon className="w-4 h-4" style={{ color: "rgba(255,255,255,0.2)" }} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 700 }}>{job.title}</p>
        <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, marginTop: 2 }}>{job.type}</p>
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>FILLED</span>
    </div>
  );
}

function MetaTag({ icon: Icon, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, padding: "5px 10px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}
