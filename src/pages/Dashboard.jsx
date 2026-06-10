import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Activity, Bell, TrendingUp, FileText, Calendar, CheckCircle, Clock, XCircle } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const STATUS_STYLES = {
  new:       { label: "NEW",       bg: `${GOLD}18`,               border: `${GOLD}45`,               color: GOLD },
  reviewing: { label: "REVIEWING", bg: "rgba(59,130,246,0.12)",   border: "rgba(59,130,246,0.35)",   color: "#60a5fa" },
  hired:     { label: "HIRED",     bg: "rgba(34,197,94,0.12)",    border: "rgba(34,197,94,0.35)",    color: "#4ade80" },
  rejected:  { label: "REJECTED",  bg: "rgba(239,68,68,0.10)",    border: "rgba(239,68,68,0.3)",     color: "#f87171" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [candidates, setCandidates] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState({});

  // Load applications from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    setCandidates(stored);
  }, []);

  const updateStatus = (id, status) => {
    const updated = candidates.map((c) => c.id === id ? { ...c, status } : c);
    setCandidates(updated);
    localStorage.setItem("nova_applications", JSON.stringify(updated));
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "candidates", label: `Candidates${candidates.length ? ` (${candidates.length})` : ""}` },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#060504" }}>
      {/* Sidebar + main layout */}
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside
          className="hidden md:flex flex-col w-60 flex-shrink-0 border-r py-8 px-5"
          style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <span className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
          </div>

          <p className="text-[9px] tracking-[0.22em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.22)" }}>DASHBOARD</p>
          <nav className="space-y-1 flex-1">
            {[
              { key: "overview", label: "Overview", icon: Activity },
              { key: "candidates", label: "Candidates", icon: Users },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left"
                style={{
                  background: activeTab === key ? `${GOLD}14` : "transparent",
                  color: activeTab === key ? GOLD : "rgba(255,255,255,0.4)",
                  border: activeTab === key ? `1px solid ${GOLD}30` : "1px solid transparent",
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
                {key === "candidates" && candidates.length > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: `${GOLD}25`, color: GOLD }}>
                    {candidates.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <button
            onClick={() => navigate("/")}
            className="text-xs transition-colors hover:text-white mt-4"
            style={{ color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            ← Back to site
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 md:p-10 overflow-x-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[9px] tracking-[0.28em] uppercase mb-1" style={{ color: GOLD }}>NOVA PULSE</p>
              <h1 className="text-2xl font-black text-white">
                {activeTab === "overview" ? "Dashboard" : "Candidates"}
              </h1>
            </div>
            {/* Mobile tabs */}
            <div className="flex md:hidden gap-2">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className="px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded-lg transition-all"
                  style={{
                    background: activeTab === t.key ? `${GOLD}18` : "rgba(255,255,255,0.04)",
                    color: activeTab === t.key ? GOLD : "rgba(255,255,255,0.35)",
                    border: `1px solid ${activeTab === t.key ? GOLD + "40" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Leads Tracked", value: "—", sub: "This month", icon: TrendingUp },
                  { label: "Calls Answered", value: "—", sub: "This week", icon: Bell },
                  { label: "Open Applications", value: candidates.filter(c => c.status === "new" || !c.status).length, sub: "Need review", icon: FileText },
                  { label: "System Status", value: "Active", sub: "All systems go", icon: Activity },
                ].map(({ label, value, sub, icon: Icon }) => (
                  <div key={label} className="rounded-xl p-5"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}25` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-white">{value}</p>
                    <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>{sub}</p>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="rounded-xl p-6"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[9px] tracking-[0.22em] uppercase mb-5" style={{ color: GOLD }}>QUICK ACTIONS</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "View Candidates", action: () => setActiveTab("candidates") },
                    { label: "Visit Website", action: () => navigate("/") },
                    { label: "Book Demo Page", action: () => navigate("/book-demo") },
                  ].map(({ label, action }) => (
                    <button key={label} onClick={action}
                      className="py-3 text-xs font-semibold tracking-wider uppercase rounded-lg transition-all"
                      style={{ border: `1px solid ${GOLD}35`, color: GOLD, background: `${GOLD}08` }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent applications preview */}
              {candidates.length > 0 && (
                <div className="rounded-xl p-6"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-[9px] tracking-[0.22em] uppercase" style={{ color: GOLD }}>RECENT APPLICATIONS</p>
                    <button onClick={() => setActiveTab("candidates")}
                      className="text-[10px] transition-colors hover:opacity-80" style={{ color: GOLD, background: "none", border: "none", cursor: "pointer" }}>
                      View all →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {candidates.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex items-center gap-4 py-2 border-b"
                        style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                          {(c.name || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                          <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{c.position}</p>
                        </div>
                        <StatusBadge status={c.status || "new"} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CANDIDATES ── */}
          {activeTab === "candidates" && (
            <div>
              {candidates.length === 0 ? (
                <div className="rounded-xl p-16 text-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Users className="w-10 h-10 mx-auto mb-4" style={{ color: "rgba(255,255,255,0.15)" }} />
                  <p className="font-bold text-white mb-2">No applications yet</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Applications submitted via <a href="/careers" className="underline" style={{ color: GOLD }}>/careers</a> will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {candidates.map((c) => (
                    <CandidateCard key={c.id} candidate={c} onStatusChange={(s) => updateStatus(c.id, s)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.new;
  return (
    <span className="text-[9px] font-bold tracking-[0.18em] px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.label}
    </span>
  );
}

function CandidateCard({ candidate: c, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const date = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Header row */}
      <div className="flex items-center gap-4 p-5">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
          style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
          {(c.name || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">{c.name}</p>
          <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{c.position}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          <Calendar className="w-3 h-3" />
          {date}
        </div>
        <StatusBadge status={c.status || "new"} />
        <button
          onClick={() => setOpen(!open)}
          className="text-[10px] font-semibold tracking-wider transition-colors ml-2"
          style={{ color: open ? GOLD : "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
          {open ? "CLOSE" : "VIEW"}
        </button>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            {/* Contact */}
            <div>
              <p className="text-[9px] tracking-[0.22em] uppercase mb-3" style={{ color: GOLD }}>CONTACT</p>
              <div className="space-y-1.5">
                <Detail label="Email" value={c.email} />
                <Detail label="Phone" value={c.phone} />
                {c.portfolioUrl && <Detail label="Portfolio" value={<a href={c.portfolioUrl} target="_blank" rel="noreferrer" style={{ color: GOLD }} className="underline">{c.portfolioUrl}</a>} />}
              </div>
            </div>
            {/* Equipment */}
            <div>
              <p className="text-[9px] tracking-[0.22em] uppercase mb-3" style={{ color: GOLD }}>EQUIPMENT & SKILLS</p>
              <div className="space-y-1.5">
                <Detail label="Can Record" value={c.canRecord} />
                <Detail label="Owns Camera" value={c.ownsCamera} />
                <Detail label="Has Drone" value={c.hasDrone} />
                <Detail label="Editing Exp." value={c.hasEditingExp === "yes" ? `Yes — ${c.editingSoftware || "unspecified"}` : "No"} />
              </div>
            </div>
          </div>

          {/* Background */}
          <div className="mt-5 space-y-3">
            {c.experience && <Detail label="Previous Experience" value={c.experience} block />}
            {c.education && <Detail label="Education" value={c.education} block />}
            {c.whyNova && <Detail label="Why Nova Systems" value={c.whyNova} block />}
            {c.availability && <Detail label="Availability" value={c.availability} />}
            {c.expectedPay && <Detail label="Expected Pay/Deliverable" value={c.expectedPay} />}
          </div>

          {/* Status update */}
          <div className="mt-5 pt-4 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] tracking-[0.2em] uppercase mr-2" style={{ color: "rgba(255,255,255,0.3)" }}>UPDATE STATUS:</p>
            {Object.entries(STATUS_STYLES).map(([key, s]) => (
              <button key={key} onClick={() => onStatusChange(key)}
                className="text-[9px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: (c.status || "new") === key ? s.bg : "rgba(255,255,255,0.04)",
                  border: `1px solid ${(c.status || "new") === key ? s.border : "rgba(255,255,255,0.1)"}`,
                  color: (c.status || "new") === key ? s.color : "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, block }) {
  if (!value) return null;
  return (
    <div className={block ? "space-y-1" : "flex items-start gap-2"}>
      <p className="text-[9px] tracking-[0.18em] uppercase flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
        {label}{!block && ":"}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{value}</p>
    </div>
  );
}