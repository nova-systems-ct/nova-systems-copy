import React, { useState } from "react";
import { Camera, Users, Code, TrendingUp, MapPin, Clock, DollarSign, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const JOBS = [
  {
    id: "videographer",
    title: "Videographer / Content Creator",
    icon: Camera,
    type: "Part Time · Per Project",
    pay: "$20/hour · $200 biweekly",
    hours: "10 hrs biweekly",
    location: "Waterbury, CT",
    tag: "CONTENT",
    open: true,
    description:
      "We need a videographer who can make local businesses look elite. You'll film at client locations — barbershops, restaurants, retail stores — capturing content that stops the scroll.",
    requirements: [
      "Must own camera or 1080p+ phone",
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
    hours: "Flexible",
    location: "Waterbury, CT",
    tag: "SALES",
    open: true,
    description:
      "Represent Nova Systems in the field. Walk into local businesses, pitch our services, book meetings for Isaac. You eat what you kill. No cap on earnings.",
    requirements: [
      "Confident, presentable, well-spoken",
      "Own reliable transportation",
      "Hustle mentality — self-motivated",
    ],
    highlight: null,
    bonus: "No cap on earnings",
  },
  {
    id: "web-dev",
    title: "Web Developer",
    icon: Code,
    type: "Part Time",
    pay: "Competitive",
    hours: "Flexible",
    location: "Waterbury, CT",
    tag: "TECH",
    open: false,
    description: "Build and maintain client websites using modern web technologies.",
  },
  {
    id: "brand-ambassador",
    title: "Brand Ambassador",
    icon: Users,
    type: "Part Time",
    pay: "Base + Commission",
    hours: "Flexible",
    location: "Waterbury, CT",
    tag: "MARKETING",
    open: false,
    description: "Represent Nova Systems at events and in the community.",
  },
];

const FILTERS = ["All Positions", "Open", "Filled"];

export default function JobListings({ onApply }) {
  const [filter, setFilter] = useState("All Positions");

  const filtered = JOBS.filter((j) => {
    if (filter === "Open") return j.open;
    if (filter === "Filled") return !j.open;
    return true;
  });

  return (
    <section className="py-16 md:py-24 px-6 bg-black">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <p className="text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: GOLD }}>OPEN ROLES</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">Current Openings</h2>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-10 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-5 py-2 text-[10px] font-bold tracking-[0.18em] uppercase rounded-full transition-all duration-200"
              style={{
                background: filter === f ? GOLD_GRADIENT : "rgba(255,255,255,0.04)",
                color: filter === f ? "#0a0800" : "rgba(255,255,255,0.4)",
                border: filter === f ? "1px solid transparent" : "1px solid rgba(255,255,255,0.1)",
              }}>
              {f}
            </button>
          ))}
        </div>

        {/* Job grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} onApply={onApply} />
          ))}
        </div>
      </div>
    </section>
  );
}

function JobCard({ job, onApply }) {
  const [hovered, setHovered] = useState(false);
  const Icon = job.icon;

  if (!job.open) {
    return (
      <div className="rounded-xl p-7 flex flex-col gap-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", opacity: 0.5 }}>
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Icon className="w-5 h-5" style={{ color: "rgba(255,255,255,0.2)" }} />
          </div>
          <span className="text-[9px] font-bold tracking-[0.2em] px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
            POSITION FILLED
          </span>
        </div>
        <div>
          <h3 className="font-bold text-base mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{job.title}</h3>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.18)" }}>{job.description}</p>
        </div>
        <div className="flex flex-wrap gap-2 mt-auto">
          <MetaTag icon={Clock} label={job.type} muted />
          <MetaTag icon={MapPin} label={job.location} muted />
        </div>
        <div className="py-2.5 text-center text-[10px] font-bold tracking-[0.18em] uppercase rounded-lg"
          style={{ background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.05)" }}>
          POSITION FILLED
        </div>
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="rounded-xl p-7 flex flex-col gap-5 transition-all duration-300"
      style={{
        background: hovered ? "rgba(212,160,48,0.05)" : "rgba(255,255,255,0.04)",
        border: hovered ? `1px solid ${GOLD}55` : "1px solid rgba(255,255,255,0.09)",
        boxShadow: hovered ? `0 8px 40px ${GOLD}12` : "none",
      }}>
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40` }}>
          <Icon className="w-5 h-5" style={{ color: GOLD }} />
        </div>
        <span className="text-[9px] font-bold tracking-[0.2em] px-3 py-1 rounded-full"
          style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
          {job.tag}
        </span>
      </div>

      <div>
        <h3 className="text-white font-bold text-lg leading-snug mb-2">{job.title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{job.description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <MetaTag icon={Clock} label={job.type} />
        <MetaTag icon={DollarSign} label={job.pay} />
        <MetaTag icon={MapPin} label={job.location} />
        {job.hours && <MetaTag label={job.hours} />}
      </div>

      {job.requirements && (
        <ul className="space-y-1.5 flex-1">
          {job.requirements.map((req, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-[5px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: GOLD }} />
              <span className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{req}</span>
            </li>
          ))}
        </ul>
      )}

      {job.highlight && (
        <div className="rounded-lg px-4 py-2.5 text-center"
          style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}30` }}>
          <p className="text-[10px] font-semibold tracking-wide" style={{ color: GOLD }}>★ {job.highlight}</p>
        </div>
      )}

      {job.bonus && (
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>+ {job.bonus}</p>
      )}

      <button onClick={() => onApply(job.id)}
        className="w-full py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase rounded-lg flex items-center justify-center gap-2 transition-all hover:opacity-90"
        style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
        APPLY NOW <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function MetaTag({ icon: Icon, label, muted }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full"
      style={{
        background: muted ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
        border: muted ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.09)",
        color: muted ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.45)",
      }}>
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
      {label}
    </span>
  );
}