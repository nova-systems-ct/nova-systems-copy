import React, { useState } from "react";
import { Camera, Share2, Users, Wind, Code, Palette, HeadphonesIcon, MapPin, Clock, DollarSign, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const JOBS = [
  {
    id: "videographer",
    title: "Lead Videographer / Content Creator",
    icon: Camera,
    type: "Part Time · Per Project",
    pay: "$20–25/hour",
    hours: "10–15 hrs/week",
    location: "Waterbury, CT",
    tag: "CONTENT",
    open: true,
    description:
      "We need a videographer who can make local businesses look elite. You'll film at client locations — barbershops, restaurants, retail stores — capturing content that stops the scroll. Drone footage is a massive plus and will be prioritized.",
    requirements: [
      "Own camera or 1080p+ phone",
      "Own drone preferred — drone operators are prioritized",
      "Video editing experience required (CapCut, Premiere, or DaVinci)",
      "Portfolio of previous work required",
      "Reliable transportation",
      "Available weekdays and some weekends",
    ],
    bonus: "Bonus per viral post",
    highlight: "Drone operators are highly valued",
  },
  {
    id: "social-media",
    title: "Social Media Manager",
    icon: Share2,
    type: "Part Time · Remote + On-Site",
    pay: "$15–20/hour",
    hours: "10–15 hrs/week",
    location: "Remote + Waterbury, CT",
    tag: "MARKETING",
    open: true,
    description:
      "Manage Instagram, TikTok, and Facebook for Nova Systems clients. Create content calendars, write captions, schedule posts, respond to comments. Must understand local market trends in Connecticut.",
    requirements: [
      "Must own equipment and be able to film",
      "Experience managing business social accounts",
      "Knowledge of trending audio and hashtag strategy",
      "CapCut or similar editing skills required",
    ],
    bonus: "Pay based on results",
    highlight: null,
  },
  {
    id: "ambassador",
    title: "Brand Ambassador / Sales Representative",
    icon: Users,
    type: "Part Time · Commission + Base",
    pay: "$15/hr + 10% commission",
    hours: "Flexible",
    location: "Waterbury, CT",
    tag: "SALES",
    open: true,
    description:
      "Represent Nova Systems in the field. Identify local businesses that need websites, social media, or automation. Walk in, introduce yourself, book meetings for Isaac. You get paid when deals close.",
    requirements: [
      "Confident, presentable, well-spoken",
      "Own transportation",
      "Able to film testimonial and walkthrough videos",
      "Hustle mentality",
    ],
    bonus: "10% commission on every deal you close",
    highlight: null,
  },
  {
    id: "drone",
    title: "Drone Operator / Aerial Cinematographer",
    icon: Wind,
    type: "Per Project",
    pay: "$25/hour",
    hours: "Project-based",
    location: "Waterbury, CT area",
    tag: "CONTENT",
    open: true,
    description:
      "Capture aerial footage for client websites, social media, and promotional content. Must be FAA certified or working toward certification.",
    requirements: [
      "Own professional drone (DJI preferred)",
      "FAA Part 107 license preferred",
      "Portfolio of aerial footage required",
      "Own editing software",
    ],
    bonus: "Project bonuses",
    highlight: "FAA Part 107 preferred",
  },
  {
    id: "web-dev",
    title: "Web Developer Intern",
    icon: Code,
    type: "Internship",
    pay: "Paid",
    hours: "20 hrs/week",
    location: "Waterbury, CT",
    tag: "TECH",
    open: false,
    description: "Build and maintain client websites using modern web technologies.",
    requirements: [],
    bonus: null,
    highlight: null,
  },
  {
    id: "graphic-designer",
    title: "Graphic Designer",
    icon: Palette,
    type: "Part Time",
    pay: "Competitive",
    hours: "Flexible",
    location: "Remote",
    tag: "DESIGN",
    open: false,
    description: "Create visual assets for client brands across social media and web.",
    requirements: [],
    bonus: null,
    highlight: null,
  },
  {
    id: "client-success",
    title: "Client Success Coordinator",
    icon: HeadphonesIcon,
    type: "Part Time",
    pay: "Competitive",
    hours: "15 hrs/week",
    location: "Waterbury, CT",
    tag: "OPS",
    open: false,
    description: "Onboard new clients, manage relationships, and ensure deliverables are met on time.",
    requirements: [],
    bonus: null,
    highlight: null,
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
      <div className="max-w-6xl mx-auto">

        {/* Section header */}
        <div className="mb-10">
          <p className="text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: GOLD }}>OPEN ROLES</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">Current Openings</h2>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-10 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-5 py-2 text-[10px] font-bold tracking-[0.18em] uppercase rounded-full transition-all duration-200"
              style={{
                background: filter === f ? GOLD_GRADIENT : "rgba(255,255,255,0.04)",
                color: filter === f ? "#0a0800" : "rgba(255,255,255,0.4)",
                border: filter === f ? "1px solid transparent" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Job grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
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
    // Filled card — grayed out
    return (
      <div
        className="rounded-xl p-7 flex flex-col gap-5"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          opacity: 0.55,
        }}
      >
        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color: "rgba(255,255,255,0.25)" }} />
          </div>
          <span
            className="text-[9px] font-bold tracking-[0.2em] px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            POSITION FILLED
          </span>
        </div>

        <div>
          <h3 className="text-white/40 font-bold text-base leading-tight mb-2">{job.title}</h3>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.2)" }}>{job.description}</p>
        </div>

        <div className="flex flex-wrap gap-2 mt-auto">
          <MetaTag icon={Clock} label={job.type} muted />
          <MetaTag icon={DollarSign} label={job.pay} muted />
          <MetaTag icon={MapPin} label={job.location} muted />
        </div>

        <div
          className="mt-1 py-2.5 text-center text-[10px] font-bold tracking-[0.18em] uppercase rounded-lg"
          style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          POSITION FILLED
        </div>
      </div>
    );
  }

  // Open card
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl p-7 flex flex-col gap-5 transition-all duration-300"
      style={{
        background: hovered ? "rgba(212,160,48,0.05)" : "rgba(255,255,255,0.04)",
        border: hovered ? `1px solid ${GOLD}55` : "1px solid rgba(255,255,255,0.09)",
        boxShadow: hovered ? `0 8px 40px ${GOLD}12` : "none",
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40` }}
        >
          <Icon className="w-5 h-5" style={{ color: GOLD }} />
        </div>
        <span
          className="text-[9px] font-bold tracking-[0.2em] px-3 py-1 rounded-full"
          style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}
        >
          {job.tag}
        </span>
      </div>

      {/* Title + description */}
      <div>
        <h3 className="text-white font-bold text-base leading-snug mb-2">{job.title}</h3>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{job.description}</p>
      </div>

      {/* Meta tags */}
      <div className="flex flex-wrap gap-2">
        <MetaTag icon={Clock} label={job.type} />
        <MetaTag icon={DollarSign} label={job.pay} />
        <MetaTag icon={MapPin} label={job.location} />
        {job.hours && job.hours !== "Flexible" && job.hours !== "Project-based" && (
          <MetaTag label={job.hours} />
        )}
      </div>

      {/* Requirements */}
      {job.requirements.length > 0 && (
        <ul className="space-y-1.5 flex-1">
          {job.requirements.map((req, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-[5px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: GOLD }} />
              <span className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{req}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Highlight badge */}
      {job.highlight && (
        <div
          className="rounded-lg px-4 py-2 text-center"
          style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}30` }}
        >
          <p className="text-[10px] font-semibold tracking-wide" style={{ color: GOLD }}>
            ★ {job.highlight}
          </p>
        </div>
      )}

      {/* Bonus */}
      {job.bonus && (
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          + {job.bonus}
        </p>
      )}

      {/* CTA */}
      <button
        onClick={() => onApply(job.id)}
        className="mt-auto w-full py-3 text-[10px] font-bold tracking-[0.18em] uppercase rounded-lg flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90"
        style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
      >
        APPLY NOW <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function MetaTag({ icon: Icon, label, muted }) {
  return (
    <span
      className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full"
      style={{
        background: muted ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
        border: muted ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(255,255,255,0.09)",
        color: muted ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.45)",
      }}
    >
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
      {label}
    </span>
  );
}