import React from "react";
import { ExternalLink, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const projects = [
  {
    client: "Mars Hill Apologetics",
    tagline: "Ministry website, CMS, and admin dashboard — live in CT.",
    description:
      "A Reformed apologetics ministry in Connecticut. Custom Vite + Supabase build — full CMS, sermon archive, and admin dashboard for the founder.",
    services: ["Custom Website", "Supabase CMS", "Admin Dashboard", "Resend Email"],
    url: "https://marshillapologetics.com",
    domain: "marshillapologetics.com",
    category: "Religious Ministry",
    status: "Live",
  },
  {
    client: "TRIO Upward Bound",
    tagline: "Student management system for federal college-prep program.",
    description:
      "Federally funded college-prep program at CT State NVCC. Full student management system — attendance, reporting, and communication tools serving 4 schools.",
    services: ["Student Management System", "Reporting Dashboard", "Admin Portal"],
    url: null,
    domain: "CT State NVCC",
    category: "Education / Government",
    status: "Pilot",
  },
  {
    client: "Flow Barbershop",
    tagline: "Social media presence — Instagram, Facebook, and content strategy.",
    description:
      "A Waterbury barbershop ready to grow its brand. Nova Systems manages their full social media presence — content creation, scheduling, and audience growth across Instagram and Facebook.",
    services: ["Social Media Management", "Content Creation", "Instagram", "Facebook"],
    url: null,
    domain: "Waterbury, CT",
    category: "Local Business",
    status: "Active",
  },
];

export default function PortfolioSection() {
  return (
    <section
      className="py-20 px-6"
      style={{
        background: "rgba(255,255,255,0.01)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p
            className="text-[9px] tracking-[0.35em] uppercase mb-4"
            style={{ color: GOLD }}
          >
            OUR WORK
          </p>
          <h2 className="text-3xl font-black text-white mb-5 leading-tight">
            Built for real clients.{" "}
            <span
              style={{
                background: G,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Deployed for real results.
            </span>
          </h2>
          <p
            className="text-sm leading-relaxed max-w-lg mx-auto"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            No mockups. No demos. Every Nova system is live, in production,
            running for a real client.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p, i) => (
            <ProjectCard key={i} project={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project: p }) {
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        transition: "all 0.18s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = `${GOLD}30`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
      }}
    >
      <div
        className="px-7 pt-7 pb-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <span
            className="text-[8px] tracking-[0.28em] uppercase font-semibold"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            {p.category}
          </span>
          <span
            className="text-[9px] font-bold tracking-[0.15em] uppercase px-3 py-1 rounded-full"
            style={{
              color: (p.status === "Live" || p.status === "Active") ? "#4ade80" : GOLD,
              background: (p.status === "Live" || p.status === "Active") ? "rgba(34,197,94,0.1)" : `${GOLD}12`,
              border: `1px solid ${(p.status === "Live" || p.status === "Active") ? "rgba(34,197,94,0.25)" : `${GOLD}28`}`,
            }}
          >
            {p.status}
          </span>
        </div>
        <h3 className="text-xl font-black text-white mb-2">{p.client}</h3>
        <p className="text-xs font-semibold tracking-wide mb-3" style={{ color: GOLD }}>
          {p.tagline}
        </p>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "rgba(255,255,255,0.38)" }}
        >
          {p.description}
        </p>
      </div>

      <div className="px-7 py-6 flex flex-col gap-5 flex-1">
        <div>
          <p
            className="text-[8px] tracking-[0.28em] uppercase font-semibold mb-3"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            Delivered
          </p>
          <div className="flex flex-wrap gap-2">
            {p.services.map((s, i) => (
              <span
                key={i}
                className="text-[10px] font-semibold px-3 py-1 rounded-full"
                style={{
                  color: GOLD,
                  background: `${GOLD}10`,
                  border: `1px solid ${GOLD}20`,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          {p.url ? (
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.12em] uppercase"
              style={{ color: GOLD }}
            >
              <ExternalLink className="w-3 h-3" />
              {p.domain}
              <ArrowRight className="w-3 h-3" />
            </a>
          ) : (
            <span
              className="text-xs font-semibold flex items-center gap-2"
              style={{ color: "rgba(255,255,255,0.22)" }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: GOLD,
                  opacity: 0.4,
                  flexShrink: 0,
                }}
              />
              {p.domain}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
