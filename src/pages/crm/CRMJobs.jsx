import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ExternalLink } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import { inputStyle } from "@/components/crm/CRMField";

const GOLD = "#D4A030";

const STATUS_STYLES = {
  new:                 { label: "NEW",       bg: `${GOLD}18`,              border: `${GOLD}45`,              color: GOLD },
  reviewing:           { label: "REVIEWING", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.35)",  color: "#60a5fa" },
  interview_scheduled: { label: "INTERVIEW", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)", color: "#a78bfa" },
  hired:               { label: "HIRED",     bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.35)",   color: "#4ade80" },
  declined:            { label: "DECLINED",  bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.3)",    color: "#f87171" },
};

const FILTERS = ["All", "new", "reviewing", "interview_scheduled", "hired", "declined"];

export default function CRMJobs() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    setCandidates(JSON.parse(localStorage.getItem("nova_applications") || "[]"));
  }, []);

  const filtered = candidates.filter((c) => {
    const q = search.toLowerCase();
    const matchQ = !q || c.name?.toLowerCase().includes(q) || c.position?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    const matchF = filter === "All" || (c.status || "new") === filter;
    return matchQ && matchF;
  });

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10">
        <div className="mb-8">
          <p className="text-[9px] tracking-[0.3em] uppercase mb-1" style={{ color: GOLD }}>CRM</p>
          <h1 className="text-2xl font-black text-white">Job Applicants</h1>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }} />
            <input placeholder="Search by name, position, email..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36 }} />
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTERS.map((f) => {
            const s = f === "All" ? null : STATUS_STYLES[f];
            return (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 text-[9px] font-bold tracking-[0.15em] uppercase rounded-full transition-all"
                style={{
                  background: filter === f ? (s ? s.bg : `${GOLD}18`) : "rgba(255,255,255,0.04)",
                  border: `1px solid ${filter === f ? (s ? s.border : `${GOLD}45`) : "rgba(255,255,255,0.08)"}`,
                  color: filter === f ? (s ? s.color : GOLD) : "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                }}>
                {f === "All" ? "All" : STATUS_STYLES[f].label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {filtered.map((c) => {
            const status = c.status || "new";
            const s = STATUS_STYLES[status] || STATUS_STYLES.new;
            const date = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
            return (
              <div key={c.id}
                className="rounded-xl p-5 cursor-pointer transition-all group"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                onClick={() => navigate(`/dashboard/jobs/${c.id}`)}>
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`, color: "#0a0800" }}>
                    {(c.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-white text-sm">{c.name}</p>
                      <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                        {s.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{c.position}</span>
                      {c.ownsCamera && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>Camera: {c.ownsCamera}</span>}
                      {c.hasDrone && c.hasDrone === "yes" && <span className="text-[10px]" style={{ color: GOLD }}>🚁 Drone</span>}
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>{date}</span>
                    </div>
                  </div>
                  {c.portfolioUrl && (
                    <a href={c.portfolioUrl} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[10px] hover:opacity-70"
                      style={{ color: GOLD }}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl p-16 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white font-bold mb-2">No applicants found</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                Applications from <a href="/careers" style={{ color: GOLD }}>/careers</a> appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </CRMSidebar>
  );
}