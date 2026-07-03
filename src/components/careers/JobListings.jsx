import React from "react";
import { Camera, TrendingUp, Wind, Bot, MapPin, Clock, DollarSign, ArrowRight, CheckCircle2 } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

export const JOBS = [
  {
    id: "content-creator",
    title: "Social Media Content Creator",
    icon: Camera,
    type: "Per Job / Per Shoot",
    pay: "Paid per job — rate grows with us",
    location: "Connecticut (Fairfield County priority)",
    tag: "CONTENT",
    description:
      "Nova Systems is looking for a creative content creator based in Connecticut. You will visit client locations across CT (Fairfield County priority) to film, photograph, and produce short-form content for Instagram, TikTok, Facebook, and YouTube. You must have your own equipment and reliable transportation. You will receive creative direction from Nova Systems and work on a per-client, per-shoot basis.",
    requirements: [
      "Own camera and video equipment",
      "Own reliable vehicle",
      "Connecticut based",
      "Portfolio of past content work required",
      "Experience with CapCut or Premiere Pro preferred",
    ],
    highlight: "Pay is per job. As we grow, your rate grows with us.",
  },
  {
    id: "videographer-drone",
    title: "Videographer & Drone Operator",
    icon: Wind,
    type: "Per Job",
    pay: "Paid per job — first jobs starting soon",
    location: "Connecticut (Fairfield County priority)",
    tag: "AERIAL",
    description:
      "Nova Systems is looking for a skilled videographer and drone operator in Connecticut. You will film client locations, products, storefronts, and events across CT with a focus on Fairfield County — drone footage of client locations, vehicle wraps, signage, and aerial property shots. Must own your own camera and drone equipment and have reliable transportation.",
    requirements: [
      "Own professional camera",
      "Own drone (FAA Part 107 preferred, not required)",
      "Own reliable vehicle",
      "Connecticut based",
      "Portfolio required",
    ],
    highlight: "FAA Part 107 certified pilots prioritized",
  },
  {
    id: "ai-agent-specialist",
    title: "AI Agent Specialist",
    icon: Bot,
    type: "Remote · Per Project",
    pay: "Paid per project",
    location: "Remote",
    tag: "AI / REMOTE",
    description:
      "Nova Systems is looking for someone who understands AI tools, automation, and prompt engineering. You will help set up and manage AI phone agents, chatbots, automated follow-up sequences, and CRM workflows for Nova Systems clients. This is a remote position — you must be highly technical, self-directed, and passionate about AI tools.",
    requirements: [
      "Experience with ChatGPT, Claude, Make, Zapier, Voiceflow, or similar",
      "Strong written communication",
      "Own laptop",
      "Portfolio or examples of AI workflows built",
    ],
    highlight: "Fully remote — work from anywhere",
  },
];

export const SALES_JOB = {
  id: "sales-rep",
  headline: "Close Deals. Keep the Commission. No Cap.",
  subheadline:
    "This is not a salary job. This is not an hourly job. This is a commission-only sales position where YOUR effort determines YOUR income. If you close a $5,000/month client you earn 15–20% of that deal. That's $750 to $1,000 from one signature.",
  description:
    "Nova Systems is a Connecticut-based AI and technology company that builds websites, AI phone systems, social media management, CRM, and full business infrastructure for local businesses. We are growing fast and we need closers. Not people who book meetings — closers. People who shake hands, present value, and get contracts signed. You will be given a territory in Connecticut, a proposal template, a contract, and full training. You find the businesses, you book the meeting, you present Nova Systems, and you close the deal. The client signs. You get paid. Simple.",
  commission: [
    "15% commission on all deals under $2,000/month",
    "20% commission on all deals $2,000/month and above",
    "Commission paid after the client makes their first payment",
    "$500 retention bonus for every client that stays active 6 months",
  ],
  bonus: "First rep to close 25 clients at $1,500/month or above earns a $1,000 cash bonus.",
  needs: [
    "Reliable vehicle and valid CT driver's license",
    "Professional appearance",
    "Confidence presenting in person",
    "Phone and laptop",
    "Self-motivated — no one is going to push you",
    "Spanish speaking is a major plus",
  ],
  provides: [
    "Full sales training (digital and in-person)",
    "Proposal templates and contracts ready to go",
    "Demo websites to show prospects",
    "Marketing materials",
    "Direct support from Isaac Nova (Founder)",
    "Territory assignment",
  ],
};

export default function JobListings({ onApply }) {
  return (
    <section className="py-16 md:py-24 px-6 bg-black">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-14">
          <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>OPEN ROLES</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">4 Positions Open</h2>
          <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Isaac reviews every application himself. Be real, be specific — that's what gets noticed.
          </p>
        </div>

        {/* Sales rep — featured, bold */}
        <SalesCard onApply={onApply} />

        {/* Other open positions grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {JOBS.map((job) => <OpenCard key={job.id} job={job} onApply={onApply} />)}
        </div>

      </div>
    </section>
  );
}

function SalesCard({ onApply }) {
  const job = SALES_JOB;
  return (
    <div
      className="rounded-2xl p-8 md:p-12 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, rgba(212,160,48,0.1) 0%, rgba(0,0,0,0.4) 60%)`, border: `1.5px solid ${GOLD}55`, boxShadow: `0 0 60px ${GOLD}12` }}
    >
      <div style={{ position: "absolute", top: 0, right: 0, width: 300, height: 300, background: `radial-gradient(circle, ${GOLD}18 0%, transparent 70%)`, pointerEvents: "none" }} />

      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}45`, marginBottom: 20 }}>
        <TrendingUp className="w-3 h-3" /> COMMISSION ONLY · UNCAPPED
      </span>

      <h3 className="text-3xl md:text-5xl font-black text-white leading-[1.05] mb-5" style={{ maxWidth: 640 }}>
        {job.headline}
      </h3>
      <p className="text-sm md:text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.55)", maxWidth: 680 }}>
        {job.subheadline}
      </p>

      <p className="text-sm leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 720 }}>
        {job.description}
      </p>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <SalesColumn title="Commission Structure" items={job.commission} />
        <SalesColumn title="What You Need" items={job.needs} />
        <SalesColumn title="What We Provide" items={job.provides} />
      </div>

      <div style={{ padding: "14px 20px", borderRadius: 10, background: `${GOLD}12`, border: `1px solid ${GOLD}35`, marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>★ Bonus: {job.bonus}</p>
      </div>

      <button onClick={() => onApply("sales-rep")}
        style={{ padding: "16px 32px", fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", borderRadius: 10, border: "none", cursor: "pointer", background: G, color: "#0a0800", display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "inherit", transition: "opacity 0.15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
        APPLY NOW — START CLOSING <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function SalesColumn({ title, items }) {
  return (
    <div>
      <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>{title}</p>
      <ul style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD, marginTop: 2 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{it}</span>
          </li>
        ))}
      </ul>
    </div>
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

function MetaTag({ icon: Icon, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, padding: "5px 10px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}
