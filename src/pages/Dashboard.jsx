import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Activity, Bell, FileText, Calendar, Plus, Send, X, ClipboardList, UserPlus } from "lucide-react";
import { callFunction } from "@/lib/callFunction";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const STATUS_STYLES = {
  new:                { label: "NEW",              bg: `${GOLD}18`,              border: `${GOLD}45`,              color: GOLD },
  reviewing:          { label: "REVIEWING",        bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.35)", color: "#60a5fa" },
  interview_scheduled:{ label: "INTERVIEW",        bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)",color: "#a78bfa" },
  hired:              { label: "HIRED",            bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.35)",  color: "#4ade80" },
  declined:           { label: "DECLINED",         bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.3)",   color: "#f87171" },
};

const inputStyle = {
  width: "100%", padding: "11px 14px", fontSize: 13,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box",
};

async function callEmail(type, payload) {
  await callFunction("sendEmail", { type, payload });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [candidates, setCandidates] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // Interview modal state
  const [interviewModal, setInterviewModal] = useState(null); // { candidateId, name, email }
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");

  // Add candidate modal
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "" });
  const [addLoading, setAddLoading] = useState(false);

  // New assignment modal
  const [assignModal, setAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ title: "", description: "", dueDate: "", employeeId: "" });

  const loadData = () => {
    setCandidates(JSON.parse(localStorage.getItem("nova_applications") || "[]"));
    setAssignments(JSON.parse(localStorage.getItem("nova_assignments") || "[]"));
  };

  useEffect(() => { loadData(); }, []);

  const employees = candidates.filter((c) => c.status === "hired");

  const updateStatus = async (id, status) => {
    const candidate = candidates.find((c) => c.id === id);
    if (!candidate) return;

    if (status === "interview_scheduled") {
      setInterviewModal({ candidateId: id, name: candidate.name, email: candidate.email, position: candidate.position });
      return;
    }

    const updated = candidates.map((c) => c.id === id ? { ...c, status } : c);
    setCandidates(updated);
    localStorage.setItem("nova_applications", JSON.stringify(updated));

    if (status === "hired") {
      // Create employee account
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const accounts = JSON.parse(localStorage.getItem("nova_employee_accounts") || "[]");
      const existing = accounts.find((a) => a.applicationId === id);
      if (!existing) {
        accounts.push({ id: crypto.randomUUID(), applicationId: id, email: candidate.email, name: candidate.name, password: null, token, isEmployee: true });
        localStorage.setItem("nova_employee_accounts", JSON.stringify(accounts));
      }
      const useToken = existing?.token || token;
      callEmail("status_hired", { applicantEmail: candidate.email, applicantName: candidate.name, token: useToken });
    } else if (status === "declined") {
      callEmail("status_declined", { applicantEmail: candidate.email, applicantName: candidate.name, position: candidate.position });
    }
  };

  const confirmInterview = async () => {
    if (!interviewDate || !interviewTime) return;
    const { candidateId, name, email } = interviewModal;
    const updated = candidates.map((c) => c.id === candidateId ? { ...c, status: "interview_scheduled" } : c);
    setCandidates(updated);
    localStorage.setItem("nova_applications", JSON.stringify(updated));
    await callEmail("status_interview", { applicantEmail: email, applicantName: name, interviewDate, interviewTime });
    setInterviewModal(null);
    setInterviewDate(""); setInterviewTime("");
  };

  const sendInvite = async () => {
    if (!addForm.email) return;
    setAddLoading(true);
    await callEmail("manual_invite", { toEmail: addForm.email, toName: addForm.name });
    setAddLoading(false);
    setAddModal(false);
    setAddForm({ name: "", email: "", phone: "" });
  };

  const createAssignment = () => {
    if (!assignForm.title || !assignForm.employeeId) return;
    const all = JSON.parse(localStorage.getItem("nova_assignments") || "[]");
    all.unshift({ id: Date.now().toString(), ...assignForm, status: "pending", createdAt: new Date().toISOString() });
    localStorage.setItem("nova_assignments", JSON.stringify(all));
    setAssignments(all);
    setAssignModal(false);
    setAssignForm({ title: "", description: "", dueDate: "", employeeId: "" });
  };

  const NAV_ITEMS = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "candidates", label: "Candidates", icon: Users, count: candidates.filter(c => !c.status || c.status === "new").length },
    { key: "assignments", label: "Assignments", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "#060504" }}>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 border-r py-8 px-5"
        style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3 mb-10">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        <p className="text-[9px] tracking-[0.22em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.22)" }}>ADMIN PANEL</p>
        <nav className="space-y-1 flex-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left"
              style={{
                background: activeTab === key ? `${GOLD}14` : "transparent",
                color: activeTab === key ? GOLD : "rgba(255,255,255,0.4)",
                border: activeTab === key ? `1px solid ${GOLD}30` : "1px solid transparent",
              }}>
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: `${GOLD}25`, color: GOLD }}>{count}</span>
              )}
            </button>
          ))}
        </nav>

        <button onClick={() => navigate("/")} className="text-xs hover:text-white mt-4 text-left"
          style={{ color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer" }}>
          ← Back to site
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 md:p-10 overflow-x-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[9px] tracking-[0.28em] uppercase mb-1" style={{ color: GOLD }}>NOVA PULSE</p>
            <h1 className="text-2xl font-black text-white capitalize">{activeTab === "overview" ? "Dashboard" : activeTab}</h1>
          </div>
          <div className="flex gap-2">
            {activeTab === "candidates" && (
              <button onClick={() => setAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg transition-all hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                <UserPlus className="w-3.5 h-3.5" /> Add Candidate
              </button>
            )}
            {activeTab === "assignments" && (
              <button onClick={() => setAssignModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg transition-all hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                <Plus className="w-3.5 h-3.5" /> New Assignment
              </button>
            )}
            {/* Mobile nav */}
            <div className="flex md:hidden gap-1">
              {NAV_ITEMS.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className="px-2 py-1.5 text-[9px] font-bold tracking-wider uppercase rounded-lg"
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
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Applicants", value: candidates.length, icon: FileText },
                { label: "New / Unreviewed", value: candidates.filter(c => !c.status || c.status === "new").length, icon: Bell },
                { label: "Active Employees", value: employees.length, icon: Users },
                { label: "Open Assignments", value: assignments.filter(a => a.status !== "done").length, icon: ClipboardList },
              ].map(({ label, value, icon: Icon }) => (
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
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { label: "Review Candidates", action: () => setActiveTab("candidates") },
                { label: "View Assignments", action: () => setActiveTab("assignments") },
                { label: "Visit Site", action: () => navigate("/") },
              ].map(({ label, action }) => (
                <button key={label} onClick={action}
                  className="py-3 text-xs font-semibold tracking-wider uppercase rounded-lg transition-all"
                  style={{ border: `1px solid ${GOLD}35`, color: GOLD, background: `${GOLD}08`, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CANDIDATES ── */}
        {activeTab === "candidates" && (
          <div className="space-y-4">
            {candidates.length === 0 ? (
              <div className="rounded-xl p-16 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Users className="w-10 h-10 mx-auto mb-4" style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="font-bold text-white mb-2">No applications yet</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Applications from <a href="/careers" style={{ color: GOLD }}>/careers</a> appear here.
                </p>
              </div>
            ) : candidates.map((c) => (
              <CandidateCard key={c.id} candidate={c} onStatusChange={(s) => updateStatus(c.id, s)} />
            ))}
          </div>
        )}

        {/* ── ASSIGNMENTS ── */}
        {activeTab === "assignments" && (
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="rounded-xl p-16 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <ClipboardList className="w-10 h-10 mx-auto mb-4" style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="font-bold text-white mb-2">No assignments yet</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Create an assignment to send tasks to employees.</p>
              </div>
            ) : assignments.map((a) => {
              const emp = candidates.find((c) => c.id === a.employeeId);
              return (
                <div key={a.id} className="rounded-xl p-5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white text-sm mb-1">{a.title}</p>
                      {a.description && <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{a.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-2">
                        {emp && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>→ {emp.name}</span>}
                        {a.dueDate && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>Due: {new Date(a.dueDate).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <span className="text-[9px] font-bold tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
                      style={{
                        background: a.status === "done" ? "rgba(34,197,94,0.1)" : a.status === "in_progress" ? "rgba(59,130,246,0.1)" : `${GOLD}15`,
                        color: a.status === "done" ? "#4ade80" : a.status === "in_progress" ? "#60a5fa" : GOLD,
                        border: `1px solid ${a.status === "done" ? "rgba(34,197,94,0.3)" : a.status === "in_progress" ? "rgba(59,130,246,0.3)" : GOLD + "35"}`,
                      }}>
                      {a.status === "done" ? "DONE" : a.status === "in_progress" ? "IN PROGRESS" : "PENDING"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── INTERVIEW MODAL ── */}
      {interviewModal && (
        <Modal title={`Schedule Interview — ${interviewModal.name}`} onClose={() => setInterviewModal(null)}>
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
            Location: Bread of Heaven, 141 Grand St, Waterbury, CT
          </p>
          <div className="space-y-4">
            <div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Date</label>
              <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Time</label>
              <input type="time" value={interviewTime} onChange={(e) => setInterviewTime(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <button onClick={confirmInterview}
            className="w-full mt-5 py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
            SEND INTERVIEW EMAIL
          </button>
        </Modal>
      )}

      {/* ── ADD CANDIDATE MODAL ── */}
      {addModal && (
        <Modal title="Send Invite" onClose={() => setAddModal(false)}>
          <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Send an invitation email with a link to apply at nova-systems.app/careers.
          </p>
          <div className="space-y-4">
            {[["Name", "text", "Jane Smith", "name"], ["Email *", "email", "jane@email.com", "email"], ["Phone", "tel", "+1 (860) 000-0000", "phone"]].map(([label, type, ph, key]) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>{label}</label>
                <input type={type} placeholder={ph} value={addForm[key]}
                  onChange={(e) => setAddForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
          </div>
          <button onClick={sendInvite} disabled={addLoading || !addForm.email}
            className="w-full mt-5 py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85 flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer", opacity: (!addForm.email || addLoading) ? 0.5 : 1 }}>
            {addLoading ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" /> : <><Send className="w-3.5 h-3.5" /> SEND INVITE</>}
          </button>
        </Modal>
      )}

      {/* ── NEW ASSIGNMENT MODAL ── */}
      {assignModal && (
        <Modal title="New Assignment" onClose={() => setAssignModal(false)}>
          <div className="space-y-4">
            {[["Title *", "text", "e.g. Film reel for Barber Joe", "title"], ["Description", "text", "Details about the task...", "description"], ["Due Date", "date", "", "dueDate"]].map(([label, type, ph, key]) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>{label}</label>
                {key === "description"
                  ? <textarea rows={3} placeholder={ph} value={assignForm[key]}
                      onChange={(e) => setAssignForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ ...inputStyle, resize: "none" }} />
                  : <input type={type} placeholder={ph} value={assignForm[key]}
                      onChange={(e) => setAssignForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />}
              </div>
            ))}
            <div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Assign To *</label>
              <select value={assignForm.employeeId} onChange={(e) => setAssignForm(f => ({ ...f, employeeId: e.target.value }))}
                style={{ ...inputStyle, appearance: "none" }}>
                <option value="" style={{ background: "#111" }}>Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id} style={{ background: "#111" }}>{e.name} — {e.position}</option>)}
              </select>
              {employees.length === 0 && <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>No hired employees yet.</p>}
            </div>
          </div>
          <button onClick={createAssignment}
            className="w-full mt-5 py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
            CREATE ASSIGNMENT
          </button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl p-7"
        style={{ background: "#0d0c09", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-white text-base">{title}</h3>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
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
          <Calendar className="w-3 h-3" />{date}
        </div>
        <StatusBadge status={c.status || "new"} />
        <button onClick={() => setOpen(!open)}
          className="text-[10px] font-semibold tracking-wider ml-2"
          style={{ color: open ? GOLD : "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
          {open ? "CLOSE" : "VIEW"}
        </button>
      </div>

      {open && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <div>
              <p className="text-[9px] tracking-[0.22em] uppercase mb-3" style={{ color: GOLD }}>CONTACT</p>
              <div className="space-y-1.5">
                <Detail label="Email" value={c.email} />
                <Detail label="Phone" value={c.phone} />
                {c.portfolioUrl && <Detail label="Portfolio" value={<a href={c.portfolioUrl} target="_blank" rel="noreferrer" style={{ color: GOLD }} className="underline">{c.portfolioUrl}</a>} />}
              </div>
            </div>
            <div>
              <p className="text-[9px] tracking-[0.22em] uppercase mb-3" style={{ color: GOLD }}>EQUIPMENT</p>
              <div className="space-y-1.5">
                <Detail label="Can Record" value={c.canRecord} />
                <Detail label="Owns Camera" value={c.ownsCamera} />
                <Detail label="Has Drone" value={c.hasDrone} />
                <Detail label="Editing" value={c.hasEditingExp === "yes" ? `Yes — ${c.editingSoftware || "unspecified"}` : "No"} />
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {c.experience && <Detail label="Experience" value={c.experience} block />}
            {c.whyNova && <Detail label="Why Nova Systems" value={c.whyNova} block />}
            {c.availability && <Detail label="Availability" value={c.availability} />}
            {c.expectedPay && <Detail label="Expected Pay" value={c.expectedPay} />}
          </div>
          <div className="mt-5 pt-4 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] tracking-[0.2em] uppercase mr-2" style={{ color: "rgba(255,255,255,0.3)" }}>STATUS:</p>
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
      <p className="text-[9px] tracking-[0.18em] uppercase flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{label}{!block && ":"}</p>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{value}</p>
    </div>
  );
}