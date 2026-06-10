import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Send } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import CRMModal from "@/components/crm/CRMModal";
import { inputStyle, onFocus, onBlur } from "@/components/crm/CRMField";
import { callFunction } from "@/lib/callFunction";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const STATUS_STYLES = {
  new:                 { label: "NEW",       bg: `${GOLD}18`,              border: `${GOLD}45`,              color: GOLD },
  reviewing:           { label: "REVIEWING", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.35)",  color: "#60a5fa" },
  interview_scheduled: { label: "INTERVIEW", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)", color: "#a78bfa" },
  hired:               { label: "HIRED",     bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.35)",   color: "#4ade80" },
  declined:            { label: "DECLINED",  bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.3)",    color: "#f87171" },
};

async function callEmail(type, payload) {
  await callFunction("sendEmail", { type, payload });
}

export default function CRMJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [interviewModal, setInterviewModal] = useState(false);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const apps = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    const c = apps.find(a => a.id === id);
    setCandidate(c || null);
    setNotes(c?.adminNotes || "");
  }, [id]);

  if (!candidate) return (
    <CRMSidebar>
      <div className="p-10 text-center">
        <p className="text-white font-bold mb-2">Applicant not found</p>
        <button onClick={() => navigate("/dashboard/jobs")} style={{ color: GOLD, background: "none", border: "none", cursor: "pointer" }}>← Back</button>
      </div>
    </CRMSidebar>
  );

  const updateStatus = async (status) => {
    if (status === "interview_scheduled") { setInterviewModal(true); return; }
    const apps = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    const updated = apps.map(a => a.id === id ? { ...a, status } : a);
    localStorage.setItem("nova_applications", JSON.stringify(updated));
    setCandidate(prev => ({ ...prev, status }));

    if (status === "hired") {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const accounts = JSON.parse(localStorage.getItem("nova_employee_accounts") || "[]");
      if (!accounts.find(a => a.applicationId === id)) {
        accounts.push({ id: crypto.randomUUID(), applicationId: id, email: candidate.email, name: candidate.name, password: null, token, isEmployee: true });
        localStorage.setItem("nova_employee_accounts", JSON.stringify(accounts));
      }
      callEmail("status_hired", { applicantEmail: candidate.email, applicantName: candidate.name, token });
    } else if (status === "declined") {
      callEmail("status_declined", { applicantEmail: candidate.email, applicantName: candidate.name, position: candidate.position });
    }
  };

  const confirmInterview = async () => {
    if (!interviewDate || !interviewTime) return;
    const apps = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    const updated = apps.map(a => a.id === id ? { ...a, status: "interview_scheduled" } : a);
    localStorage.setItem("nova_applications", JSON.stringify(updated));
    setCandidate(prev => ({ ...prev, status: "interview_scheduled" }));
    await callEmail("status_interview", { applicantEmail: candidate.email, applicantName: candidate.name, interviewDate, interviewTime });
    setInterviewModal(false);
  };

  const saveNotes = () => {
    const apps = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    const updated = apps.map(a => a.id === id ? { ...a, adminNotes: notes } : a);
    localStorage.setItem("nova_applications", JSON.stringify(updated));
  };

  const status = candidate.status || "new";
  const s = STATUS_STYLES[status] || STATUS_STYLES.new;

  const fields = [
    ["Email", candidate.email],
    ["Phone", candidate.phone],
    ["Position", candidate.position],
    ["Applied", candidate.submittedAt ? new Date(candidate.submittedAt).toLocaleDateString() : "—"],
    ["Availability", candidate.availability],
    ["Expected Pay", candidate.expectedPay],
  ];

  const equipFields = [
    ["Can Record", candidate.canRecord],
    ["Owns Camera", candidate.ownsCamera],
    ["Has Drone", candidate.hasDrone],
    ["Editing Exp", candidate.hasEditingExp],
    ["Software", candidate.editingSoftware],
    // sales
    ["Has Car", candidate.hasCar],
    ["Cold Calling", candidate.coldCalling],
    // drone
    ["Drone Model", candidate.droneModel],
    ["FAA Part 107", candidate.faaPart107],
    ["Years Flying", candidate.yearsFlying],
  ].filter(([, v]) => v);

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10">
        <button onClick={() => navigate("/dashboard/jobs")}
          className="flex items-center gap-2 text-xs mb-6 hover:opacity-70"
          style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Job Applicants
        </button>

        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black flex-shrink-0"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
              {(candidate.name || "?")[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">{candidate.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{candidate.position}</span>
                <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>{s.label}</span>
              </div>
            </div>
          </div>
          {candidate.portfolioUrl && (
            <a href={candidate.portfolioUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg hover:opacity-80"
              style={{ border: `1px solid ${GOLD}40`, color: GOLD }}>
              <ExternalLink className="w-3.5 h-3.5" /> Portfolio
            </a>
          )}
        </div>

        {/* Status buttons */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[9px] tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>UPDATE STATUS</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_STYLES).map(([key, st]) => (
              <button key={key} onClick={() => updateStatus(key)}
                className="text-[9px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: status === key ? st.bg : "rgba(255,255,255,0.04)",
                  border: `1px solid ${status === key ? st.border : "rgba(255,255,255,0.1)"}`,
                  color: status === key ? st.color : "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                }}>
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Contact */}
          <div className="rounded-xl p-6 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-2" style={{ color: GOLD }}>CONTACT & INFO</p>
            {fields.map(([label, value]) => value ? (
              <div key={label} className="flex items-start gap-3">
                <span className="text-[9px] tracking-[0.18em] uppercase w-24 flex-shrink-0 pt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{value}</span>
              </div>
            ) : null)}
          </div>

          {/* Equipment */}
          {equipFields.length > 0 && (
            <div className="rounded-xl p-6 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-2" style={{ color: GOLD }}>EQUIPMENT & SKILLS</p>
              {equipFields.map(([label, value]) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-[9px] tracking-[0.18em] uppercase w-24 flex-shrink-0 pt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Experience & Why Nova */}
        {[["EXPERIENCE", candidate.experience], ["WHY NOVA SYSTEMS", candidate.whyNova]].map(([label, val]) => val ? (
          <div key={label} className="rounded-xl p-6 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-3" style={{ color: GOLD }}>{label}</p>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{val}</p>
          </div>
        ) : null)}

        {/* Admin Notes */}
        <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-4" style={{ color: GOLD }}>ADMIN NOTES</p>
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Private notes about this applicant..."
            style={{ ...inputStyle, resize: "none", width: "100%" }}
            onFocus={onFocus} onBlur={onBlur} />
          <button onClick={saveNotes}
            className="mt-3 px-5 py-2 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
            SAVE NOTES
          </button>
        </div>
      </div>

      {interviewModal && (
        <CRMModal title={`Schedule Interview — ${candidate.name}`} onClose={() => setInterviewModal(false)}>
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>Location: Bread of Heaven, 141 Grand St, Waterbury, CT</p>
          <div className="space-y-4">
            <div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Date</label>
              <input type="date" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Time</label>
              <input type="time" value={interviewTime} onChange={e => setInterviewTime(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>
          <button onClick={confirmInterview} disabled={!interviewDate || !interviewTime}
            className="w-full mt-5 py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85 flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
            <Send className="w-3.5 h-3.5" /> SEND INTERVIEW EMAIL
          </button>
        </CRMModal>
      )}
    </CRMSidebar>
  );
}