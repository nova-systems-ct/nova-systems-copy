import { useState, useEffect } from "react";
import { ExternalLink, ArrowRight, X, ChevronLeft, ChevronRight } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const CAT_COLORS = {
  Website: "#60a5fa",
  Branding: "#a78bfa",
  "Social Media": "#4ade80",
  Apparel: "#f97316",
  Other: GOLD,
};

const STATIC_PROJECTS = [
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
  const [featuredItems, setFeaturedItems] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetch("/api/portfolio-items?featured=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setFeaturedItems(Array.isArray(data) && data.length > 0 ? data : []))
      .catch(() => setFeaturedItems([]));
  }, []);

  const hasDynamic = featuredItems && featuredItems.length > 0;

  const prevItem = lightbox && hasDynamic
    ? featuredItems[featuredItems.indexOf(lightbox) - 1] || null
    : null;
  const nextItem = lightbox && hasDynamic
    ? featuredItems[featuredItems.indexOf(lightbox) + 1] || null
    : null;

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
          <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>
            OUR WORK
          </p>
          <h2 className="text-3xl font-black text-white mb-5 leading-tight">
            Built for real clients.{" "}
            <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Deployed for real results.
            </span>
          </h2>
          <p className="text-sm leading-relaxed max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
            No mockups. No demos. Every Nova system is live, in production, running for a real client.
          </p>
        </div>

        {hasDynamic ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredItems.map((item, i) => (
              <DynamicCard key={item.id || i} item={item} onClick={() => setLightbox(item)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {STATIC_PROJECTS.map((p, i) => (
              <ProjectCard key={i} project={p} />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 80px", background: "rgba(0,0,0,0.93)", backdropFilter: "blur(8px)" }}
          onClick={(e) => e.target === e.currentTarget && setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, cursor: "pointer", color: "#fff", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>

          {prevItem && (
            <button onClick={() => setLightbox(prevItem)}
              style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer", color: "#fff", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft style={{ width: 18, height: 18 }} />
            </button>
          )}

          <div style={{ maxWidth: 800, width: "100%" }}>
            <img
              src={lightbox.image_url}
              alt={lightbox.title}
              style={{ width: "100%", maxHeight: "68vh", objectFit: "contain", borderRadius: 10, display: "block", background: "#050403" }}
            />
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, flex: 1 }}>{lightbox.title}</p>
              {lightbox.client_name && (
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{lightbox.client_name}</p>
              )}
              {lightbox.category && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: `${CAT_COLORS[lightbox.category] || GOLD}18`, color: CAT_COLORS[lightbox.category] || GOLD, border: `1px solid ${CAT_COLORS[lightbox.category] || GOLD}30`, textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
                  {lightbox.category}
                </span>
              )}
            </div>
          </div>

          {nextItem && (
            <button onClick={() => setLightbox(nextItem)}
              style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer", color: "#fff", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronRight style={{ width: 18, height: 18 }} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function DynamicCard({ item, onClick }) {
  const [hov, setHov] = useState(false);
  const catColor = CAT_COLORS[item.category] || GOLD;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col cursor-pointer"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${hov ? `${GOLD}28` : "rgba(255,255,255,0.08)"}`, transition: "all 0.18s", transform: hov ? "translateY(-3px)" : "translateY(0)" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      {item.image_url && (
        <div style={{ height: 200, overflow: "hidden", background: "#050403" }}>
          <img
            src={item.image_url}
            alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s", transform: hov ? "scale(1.04)" : "scale(1)" }}
          />
        </div>
      )}
      <div className="px-6 py-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-white font-bold text-base leading-snug">{item.title}</h3>
          {item.category && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}28`, whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {item.category}
            </span>
          )}
        </div>
        {item.client_name && (
          <p style={{ color: GOLD, fontSize: 11, fontWeight: 600 }}>{item.client_name}</p>
        )}
        <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, marginTop: "auto" }}>Click to view ↗</p>
      </div>
    </div>
  );
}

function ProjectCard({ project: p }) {
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", transition: "all 0.18s" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = `${GOLD}30`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
    >
      <div className="px-7 pt-7 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-5">
          <span className="text-[8px] tracking-[0.28em] uppercase font-semibold" style={{ color: "rgba(255,255,255,0.2)" }}>
            {p.category}
          </span>
          <span
            className="text-[9px] font-bold tracking-[0.15em] uppercase px-3 py-1 rounded-full"
            style={{
              color: (p.status === "Live" || p.status === "Active") ? "#4ade80" : GOLD,
              background: (p.status === "Live" || p.status === "Active") ? "rgba(34,197,94,0.1)" : `${GOLD}12`,
              border: `1px solid ${(p.status === "Live" || p.status === "Active") ? "rgba(34,197,94,0.25)" : `${GOLD}28`}`,
            }}>
            {p.status}
          </span>
        </div>
        <h3 className="text-xl font-black text-white mb-2">{p.client}</h3>
        <p className="text-xs font-semibold tracking-wide mb-3" style={{ color: GOLD }}>{p.tagline}</p>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>{p.description}</p>
      </div>

      <div className="px-7 py-6 flex flex-col gap-5 flex-1">
        <div>
          <p className="text-[8px] tracking-[0.28em] uppercase font-semibold mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>
            Delivered
          </p>
          <div className="flex flex-wrap gap-2">
            {p.services.map((s, i) => (
              <span key={i} className="text-[10px] font-semibold px-3 py-1 rounded-full" style={{ color: GOLD, background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}>
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-auto">
          {p.url ? (
            <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.12em] uppercase" style={{ color: GOLD }}>
              <ExternalLink className="w-3 h-3" />
              {p.domain}
              <ArrowRight className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-xs font-semibold flex items-center gap-2" style={{ color: "rgba(255,255,255,0.22)" }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: GOLD, opacity: 0.4, flexShrink: 0 }} />
              {p.domain}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
