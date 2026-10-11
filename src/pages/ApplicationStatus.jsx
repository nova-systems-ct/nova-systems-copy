import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Clock, CheckCircle, XCircle, Calendar, MessageSquare, MapPin, GraduationCap, FileSignature } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { authedFetch } from "@/lib/apiAuth";

const GOLD = "#C9A84C";
const G = `linear-gradient(135deg, #8a6b2a 0%, ${GOLD} 35%, #E0C476 55%, ${GOLD} 80%, #8a6b2a 100%)`;

const STATUS_CONFIG = {
  new:                 { label: "Application Received",     color: GOLD,      icon: Clock,        desc: "Your application is in the queue. Isaac will review it personally." },
  reviewing:           { label: "Under Review",             color: "#C9A84C",  icon: Clock,        desc: "Isaac is actively reviewing your application. Stay tuned." },
  interview_scheduled: { label: "Interview Scheduled",      color: "#a78bfa",  icon: Calendar,     desc: "Your interview has been scheduled. Check below for details." },
  hired:               { label: "Hired — Welcome Aboard!", color: "#4ade80",  icon: CheckCircle,  desc: "You're officially part of the Nova Systems team." },
  declined:            { label: "Not Selected",             color: "#f87171",  icon: XCircle,      desc: "We've moved forward with another candidate. Thank you for applying." },
};

const STATUS_ORDER = ["new", "reviewing", "interview_scheduled", "hired"];

// Repair task (2026-09-23): this page used to read a stale, per-browser localStorage cache of
// `nova_applications` — a change made by staff (status, interview date, notes) in the dashboard
// was invisible here forever unless this exact browser happened to have re-fetched it. Now
// fetches the caller's own real record fresh on every load, ownership-scoped server-side by the
// real Supabase Auth session (api/intake.js's my-application action) — not a client-supplied id.
export default function ApplicationStatus() {
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) { setError(true); setLoading(false); return; }
      const { data } = await supabase.auth.getSession();
      if (!data?.session) { navigate("/applicant-login"); return; }
      try {
        const r = await authedFetch("/api/intake?action=my-application");
        if (!active) return;
        if (!r.ok) { setError(true); setLoading(false); return; }
        const app = await r.json();
        if (!app) { setError(true); setLoading(false); return; }
        setApplication(app);
      } catch {
        if (active) setError(true);
      }
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    navigate("/applicant-login");
  };

  if (loading) return <div className="min-h-screen" style={{ background: "#0A0A0A" }} />;

  if (error || !application) {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6 text-center">
        <p className="text-white text-sm mb-4">We couldn&apos;t find an application linked to this account.</p>
        <a href="/careers" style={{ color: GOLD, fontSize: 13 }}>Apply at /careers</a>
      </div>
    );
  }

  const status = application.status || "new";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const StatusIcon = config.icon;
  const declined = status === "declined";
  const messages = application.status_messages || [];
  const submittedDate = application.submitted_at
    ? new Date(application.submitted_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div className="min-h-screen bg-navy px-6 py-16">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <span style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>NOVA SYSTEMS</span>
          </a>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: 8 }}>APPLICANT PORTAL</p>
        <h1 className="text-3xl font-black text-white mb-10">Your Application</h1>

        {/* Main status card */}
        <div style={{ borderRadius: 16, padding: 28, marginBottom: 20, background: "rgba(255,255,255,0.04)", border: `1px solid ${config.color}30` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${config.color}15`, border: `1px solid ${config.color}40`, flexShrink: 0 }}>
              <StatusIcon className="w-5 h-5" style={{ color: config.color }} />
            </div>
            <div>
              <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>CURRENT STATUS</p>
              <p style={{ color: config.color, fontSize: 18, fontWeight: 900, letterSpacing: "-0.01em" }}>{config.label}</p>
            </div>
          </div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.7 }}>{config.desc}</p>
        </div>

        {/* Progress timeline (not shown if declined) */}
        {!declined && (
          <div style={{ borderRadius: 14, padding: 24, marginBottom: 20, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 20 }}>PROGRESS</p>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 14, top: 14, bottom: 14, width: 1, background: "rgba(255,255,255,0.06)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {STATUS_ORDER.map((s, i) => {
                  const cfg = STATUS_CONFIG[s];
                  const StepIcon = cfg.icon;
                  const currentIdx = STATUS_ORDER.indexOf(status);
                  const done = i <= currentIdx;
                  const active = s === status;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "10px 0" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1, transition: "all 0.2s", background: done ? (active ? G : `${GOLD}15`) : "rgba(255,255,255,0.04)", border: `1px solid ${done ? (active ? "transparent" : `${GOLD}40`) : "rgba(255,255,255,0.08)"}` }}>
                        <StepIcon className="w-3.5 h-3.5" style={{ color: done ? (active ? "#0a0800" : GOLD) : "rgba(255,255,255,0.2)" }} />
                      </div>
                      <div style={{ paddingTop: 4 }}>
                        <p style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: done ? (active ? "#fff" : "rgba(255,255,255,0.6)") : "rgba(255,255,255,0.2)", transition: "all 0.2s" }}>{cfg.label}</p>
                        {active && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Current stage</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Interview details */}
        {status === "interview_scheduled" && application.interview_date && (
          <div style={{ borderRadius: 14, padding: 24, marginBottom: 20, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Calendar className="w-4 h-4" style={{ color: "#a78bfa" }} />
              <p style={{ color: "#a78bfa", fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" }}>INTERVIEW DETAILS</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Calendar className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                  {application.interview_date}{application.interview_time && ` at ${application.interview_time}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <MapPin className="w-3.5 h-3.5 mt-0.5" style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                <div>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>Bread of Heaven</p>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>Waterbury, CT — Isaac will confirm exact address via email</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages from Isaac */}
        {messages.length > 0 && (
          <div style={{ borderRadius: 14, padding: 24, marginBottom: 20, background: "rgba(255,255,255,0.025)", border: `1px solid ${GOLD}25` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <MessageSquare className="w-4 h-4" style={{ color: GOLD }} />
              <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" }}>
                MESSAGE{messages.length !== 1 ? "S" : ""} FROM ISAAC
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.7 }}>{m.message || m}</p>
                  {m.date && <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 8 }}>{new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Working agreement */}
        {application.agreement && (
          <div style={{ borderRadius: 14, padding: 24, marginBottom: 20, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <FileSignature className="w-4 h-4" style={{ color: GOLD }} />
              <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" }}>WORKING AGREEMENT</p>
            </div>
            {application.agreement.status === "signed" ? (
              <p style={{ color: "#4ade80", fontSize: 13 }}>Signed — thank you.</p>
            ) : (
              <a href={`/sign/${application.agreement.id}`} style={{ display: "inline-block", padding: "10px 18px", background: G, borderRadius: 8, color: "#0a0800", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                Review &amp; Sign Agreement
              </a>
            )}
          </div>
        )}

        {/* Nova Sales Academy */}
        <div style={{ borderRadius: 14, padding: 24, marginBottom: 20, background: `${GOLD}08`, border: `1px solid ${GOLD}25`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <GraduationCap className="w-5 h-5" style={{ color: GOLD }} />
            <div>
              <p style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>Nova Sales Academy</p>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>Training becomes available once you're invited to a Nova Systems account.</p>
            </div>
          </div>
          <a href="/dashboard/academy" style={{ padding: "9px 16px", background: "rgba(255,255,255,0.06)", border: `1px solid ${GOLD}40`, borderRadius: 7, color: GOLD, fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
            Open Academy
          </a>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 32 }}>
          Questions? Email <span style={{ color: GOLD }}>hello@nova-systems.app</span>
        </p>
      </div>
    </div>
  );
}
