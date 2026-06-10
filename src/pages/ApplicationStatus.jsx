import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Clock, CheckCircle, XCircle, Calendar, MessageSquare, MapPin, ChevronRight } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const STATUS_CONFIG = {
  new:                 { label: "Application Received",     color: GOLD,      icon: Clock,        desc: "Your application is in the queue. Isaac will review it personally." },
  reviewing:           { label: "Under Review",             color: "#60a5fa",  icon: Clock,        desc: "Isaac is actively reviewing your application. Stay tuned." },
  interview_scheduled: { label: "Interview Scheduled",      color: "#a78bfa",  icon: Calendar,     desc: "Your interview has been scheduled. Check below for details." },
  hired:               { label: "Hired — Welcome Aboard!", color: "#4ade80",  icon: CheckCircle,  desc: "You're officially part of the Nova Systems team." },
  declined:            { label: "Not Selected",             color: "#f87171",  icon: XCircle,      desc: "We've moved forward with another candidate. Thank you for applying." },
};

const STATUS_ORDER = ["new", "reviewing", "interview_scheduled", "hired"];

export default function ApplicationStatus() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [application, setApplication] = useState(null);

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem("nova_applicant_session") || "null");
    if (!s) { navigate("/applicant-login"); return; }
    setSession(s);
    const apps = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    const app = apps.find((a) => a.id === s.applicationId);
    setApplication(app || null);
  }, []);

  const logout = () => {
    localStorage.removeItem("nova_applicant_session");
    navigate("/applicant-login");
  };

  if (!session) return null;

  const status = application?.status || "new";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const StatusIcon = config.icon;
  const declined = status === "declined";
  const messages = application?.status_messages || (application?.adminMessage ? [{ message: application.adminMessage, date: application.submittedAt }] : []);
  const submittedDate = application?.submittedAt
    ? new Date(application.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div className="min-h-screen bg-black px-6 py-16">
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
              {/* Connector line */}
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
        {status === "interview_scheduled" && (application?.interviewDate || application?.interview_date) && (
          <div style={{ borderRadius: 14, padding: 24, marginBottom: 20, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Calendar className="w-4 h-4" style={{ color: "#a78bfa" }} />
              <p style={{ color: "#a78bfa", fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" }}>INTERVIEW DETAILS</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Calendar className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                  {application.interviewDate || application.interview_date}
                  {(application.interviewTime || application.interview_time) && ` at ${application.interviewTime || application.interview_time}`}
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

        {/* Application details */}
        {application && (
          <div style={{ borderRadius: 14, padding: 24, marginBottom: 20, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 16 }}>APPLICATION DETAILS</p>
            {[
              ["Name", application.name],
              ["Position", application.position],
              ["Email", application.email],
              ["Submitted", submittedDate],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: 16, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", width: 72, flexShrink: 0, paddingTop: 2 }}>{label}</p>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 32 }}>
          Questions? Email <span style={{ color: GOLD }}>hello@nova-systems.app</span>
        </p>
      </div>
    </div>
  );
}
