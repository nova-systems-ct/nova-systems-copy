import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Clock, CheckCircle, XCircle, Calendar, MessageSquare } from "lucide-react";

const GOLD = "#D4A030";

const STATUS_CONFIG = {
  new:                { label: "Application Received",    color: GOLD,          icon: Clock,         desc: "Your application is in the queue. Isaac will review it personally." },
  reviewing:          { label: "Under Review",            color: "#60a5fa",     icon: Clock,         desc: "Isaac is actively reviewing your application. Stay tuned." },
  interview_scheduled:{ label: "Interview Scheduled",     color: "#a78bfa",     icon: Calendar,      desc: "Your interview has been scheduled. Check your email for details." },
  hired:              { label: "Hired — Welcome Aboard!", color: "#4ade80",     icon: CheckCircle,   desc: "You're officially part of the Nova Systems team." },
  declined:           { label: "Not Selected",            color: "#f87171",     icon: XCircle,       desc: "We've decided to move forward with another candidate. Thank you for applying." },
};

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

  return (
    <div className="min-h-screen bg-black px-6 py-20">
      {/* Header */}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <a href="/" className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
          </a>
          <button onClick={logout} className="flex items-center gap-2 text-xs transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        <p className="text-[9px] tracking-[0.35em] uppercase mb-3" style={{ color: GOLD }}>APPLICANT PORTAL</p>
        <h1 className="text-3xl font-black text-white mb-8">Your Application</h1>

        {/* Status card */}
        <div className="rounded-2xl p-8 mb-6"
          style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${config.color}30` }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: `${config.color}15`, border: `1px solid ${config.color}40` }}>
              <StatusIcon className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>CURRENT STATUS</p>
              <p className="font-black text-lg" style={{ color: config.color }}>{config.label}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{config.desc}</p>
        </div>

        {/* Application details */}
        {application && (
          <div className="rounded-2xl p-8 space-y-4"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[9px] tracking-[0.22em] uppercase mb-2" style={{ color: GOLD }}>APPLICATION DETAILS</p>
            {[
              ["Name", application.name],
              ["Position", application.position],
              ["Submitted", application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"],
              ["Email", application.email],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-3">
                <p className="text-[9px] tracking-[0.18em] uppercase w-20 flex-shrink-0 pt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                <p className="text-sm text-white">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Messages from Isaac */}
        {application?.adminMessage && (
          <div className="rounded-2xl p-6 mt-6"
            style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${GOLD}25` }}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4" style={{ color: GOLD }} />
              <p className="text-[9px] tracking-[0.22em] uppercase" style={{ color: GOLD }}>MESSAGE FROM ISAAC</p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{application.adminMessage}</p>
          </div>
        )}

        <p className="text-center text-[10px] mt-8" style={{ color: "rgba(255,255,255,0.2)" }}>
          Questions? Email us at hello@nova-systems.app
        </p>
      </div>
    </div>
  );
}